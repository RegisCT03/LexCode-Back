import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { categories } from '@/modules/glossary/service';

/** GET /api/glossary/categories — categorías con número de términos. */
export const GET = handler(async (req) => categories(await requireAuth(req)));
