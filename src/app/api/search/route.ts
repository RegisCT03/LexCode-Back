import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { search, searchQuery } from '@/modules/glossary/service';

/** GET /api/search?q=&limit= — búsqueda en glosario, módulos, dilemas y temas de Lexis. */
export const GET = handler(async (req) => search(await requireAuth(req), parseQuery(req, searchQuery)));
