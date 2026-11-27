import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { moduleUpdateSchema } from '@/modules/content/schemas';
import { deleteModule, updateModule } from '@/modules/content/service';


export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAdmin(req);
  const id = parseParam((await params).id, uuid);
  return updateModule(ctx, id, await parseBody(req, moduleUpdateSchema));
});


export const DELETE = handler<{ id: string }>(async (req, { params }) =>
  deleteModule(await requireAdmin(req), parseParam((await params).id, uuid)),
);
