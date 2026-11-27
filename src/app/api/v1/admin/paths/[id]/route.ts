import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { pathUpdateSchema } from '@/modules/content/schemas';
import { deletePath, updatePath } from '@/modules/content/service';


export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAdmin(req);
  const id = parseParam((await params).id, uuid);
  return updatePath(ctx, id, await parseBody(req, pathUpdateSchema));
});


export const DELETE = handler<{ id: string }>(async (req, { params }) =>
  deletePath(await requireAdmin(req), parseParam((await params).id, uuid)),
);
