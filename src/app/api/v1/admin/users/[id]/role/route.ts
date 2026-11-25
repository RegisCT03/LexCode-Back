import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { roleSchema } from '@/modules/admin/schemas';
import { setRole } from '@/modules/admin/service';

/** PATCH /api/admin/users/:id/role — { role: "student" | "teacher" | "admin" } */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAdmin(req);
  const id = parseParam((await params).id, uuid);
  return setRole(ctx, id, (await parseBody(req, roleSchema)).role);
});
