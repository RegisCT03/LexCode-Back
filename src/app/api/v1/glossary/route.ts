import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { glossaryQuery, listTerms } from '@/modules/glossary/service';

/** GET /api/glossary?q=&category=&letter= — términos del glosario (búsqueda sin acentos). */
export const GET = handler(async (req) => listTerms(await requireAuth(req), parseQuery(req, glossaryQuery)));
