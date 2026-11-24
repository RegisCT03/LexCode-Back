import { z } from 'zod';
import type { AuthContext } from '@/lib/auth';
import { notFound } from '@/lib/errors';
import { pageRange, type Pagination, uuid } from '@/lib/validation';
import { unwrap } from '@/lib/supabase';

export const askSchema = z.object({
  text: z.string().trim().min(2, 'Escribe una pregunta').max(500, 'La pregunta es muy larga (máximo 500 caracteres)'),
  moduleId: uuid.optional(),
});

export const feedbackSchema = z.object({ helpful: z.boolean() });

type LexisReply = {
  message_id: number;
  found: boolean;
  expression: string;
  body: string;
  legal_reference?: { law: string; article: string | null; url: string | null } | null;
  glossary_slug?: string | null;
  suggestions?: string[];
};

export async function ask({ db }: AuthContext, input: z.infer<typeof askSchema>) {
  const r = unwrap(await db.rpc('ask_lexis', { p_text: input.text, p_module: input.moduleId ?? null })) as LexisReply;
  return {
    messageId: r.message_id,
    found: r.found,
    expression: r.expression,
    body: r.body,
    legalReference: r.legal_reference ?? null,
    glossarySlug: r.glossary_slug ?? null,
    suggestions: r.suggestions ?? [],
  };
}

/** Preguntas sugeridas (chips del chat). */
export async function suggestions({ db }: AuthContext, moduleId?: string) {
  let q = db.from('lexis_topics').select('id, name, suggested_question, module_id').not('suggested_question', 'is', null);
  if (moduleId) q = q.eq('module_id', moduleId);
  return unwrap(await q.order('name'));
}

export async function history({ db, userId }: AuthContext, page: Pagination) {
  const { from, to } = pageRange(page);
  const { data, error, count } = await db
    .from('lexis_messages')
    .select('id, user_text, topic_id, answer:lexis_answers(body, expression), was_helpful, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { items: data, total: count ?? 0, page: page.page, pageSize: page.pageSize };
}

export async function clearHistory({ db, userId }: AuthContext) {
  const { error, count } = await db.from('lexis_messages').delete({ count: 'exact' }).eq('user_id', userId);
  if (error) throw error;
  return { deleted: count ?? 0 };
}

export async function feedback({ db, userId }: AuthContext, messageId: number, helpful: boolean) {
  const { data, error } = await db
    .from('lexis_messages')
    .update({ was_helpful: helpful })
    .eq('id', messageId)
    .eq('user_id', userId)
    .select('id, was_helpful');
  if (error) throw error;
  if (!data?.length) throw notFound('No se encontró ese mensaje');
  return data[0];
}
