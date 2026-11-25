import { requireAdmin } from '@/lib/auth';
import { created, handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { glossaryCreateSchema } from '@/modules/admin/schemas';
import { createTerm } from '@/modules/admin/service';

/** POST /api/admin/glossary — nuevo término (el slug se genera del término si no se envía). */
export const POST = handler(async (req) => {
  const ctx = await requireAdmin(req);
  return created(await createTerm(ctx, await parseBody(req, glossaryCreateSchema)));
});
