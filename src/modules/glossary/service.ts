import { z } from 'zod';
import type { AuthContext } from '@/lib/auth';
import { unwrap } from '@/lib/supabase';

export const glossaryQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  letter: z.string().trim().regex(/^[A-Za-zÑñ]$/, 'Una sola letra').optional(),
});

export const searchQuery = z.object({
  q: z.string().trim().min(2, 'Escribe al menos 2 caracteres').max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const TERM_COLUMNS = 'id, slug, term, letter, category, definition, legal_citation, lexis_tip, legal_reference_id';

export async function listTerms({ db }: AuthContext, query: z.infer<typeof glossaryQuery>) {
  const rows = unwrap(
    await db.rpc('search_glossary', {
      p_query: query.q ?? null,
      p_category: query.category ?? null,
      p_letter: query.letter ?? null,
      p_limit: 200,
    }),
  ) as Record<string, unknown>[];
  // Letras con términos (para el índice alfabético del frontend)
  const letters = [...new Set(rows.map((r) => r.letter as string))].sort();
  return { items: rows, letters, total: rows.length };
}

export async function categories({ db }: AuthContext) {
  const rows = unwrap(await db.from('glossary_terms').select('category')) as { category: string }[];
  const counts = new Map<string, number>();
  rows.forEach((r) => counts.set(r.category, (counts.get(r.category) ?? 0) + 1));
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTerm({ db }: AuthContext, slug: string) {
  const term = unwrap(
    await db
      .from('glossary_terms')
      .select(`${TERM_COLUMNS}, legal_reference:legal_references(law, article, summary, official_url)`)
      .eq('slug', slug)
      .maybeSingle(),
  );
  return term;
}

/** Búsqueda global: glosario, módulos, dilemas y temas de Lexis. */
export async function search({ db }: AuthContext, query: z.infer<typeof searchQuery>) {
  return unwrap(await db.rpc('search_content', { p_query: query.q, p_limit: query.limit }));
}
