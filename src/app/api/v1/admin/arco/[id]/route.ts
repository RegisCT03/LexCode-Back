import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { arcoUpdateSchema } from '@/modules/admin/schemas';
import { updateArco } from '@/modules/admin/service';

/** PATCH /api/admin/arco/:id — { status, response } */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAdmin(req);
  const id = parseParam((await params).id, uuid);
  return updateArco(ctx, id, await parseBody(req, arcoUpdateSchema));
});
