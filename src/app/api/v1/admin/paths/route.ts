import { requireAdmin } from '@/lib/auth';
import { created, handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { pathCreateSchema } from '@/modules/content/schemas';
import { adminListPaths, createPath } from '@/modules/content/service';


export const GET = handler(async (req) => adminListPaths(await requireAdmin(req)));


export const POST = handler(async (req) => {
  const ctx = await requireAdmin(req);
  return created(await createPath(ctx, await parseBody(req, pathCreateSchema)));
});
