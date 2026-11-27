import { requireAdmin } from '@/lib/auth';
import { created, handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { moduleCreateSchema } from '@/modules/content/schemas';
import { createModule } from '@/modules/content/service';


export const POST = handler(async (req) => {
  const ctx = await requireAdmin(req);
  return created(await createModule(ctx, await parseBody(req, moduleCreateSchema)));
});
