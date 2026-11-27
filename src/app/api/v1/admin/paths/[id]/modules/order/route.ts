import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { moduleOrderSchema } from '@/modules/content/schemas';
import { orderModules } from '@/modules/content/service';


export const PUT = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAdmin(req);
  const id = parseParam((await params).id, uuid);
  return orderModules(ctx, id, await parseBody(req, moduleOrderSchema));
});
