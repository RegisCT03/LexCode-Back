import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { statusSchema } from '@/modules/admin/schemas';
import { setStatus } from '@/modules/admin/service';

/** PATCH /api/admin/users/:id/status — { status: "active" | "suspended" } */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAdmin(req);
  const id = parseParam((await params).id, uuid);
  return setStatus(ctx, id, (await parseBody(req, statusSchema)).status);
});
