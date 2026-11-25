import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { reportUpdateSchema } from '@/modules/admin/schemas';
import { updateReport } from '@/modules/admin/service';

/** PATCH /api/admin/reports/:id — { status } */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAdmin(req);
  const id = parseParam((await params).id, uuid);
  return updateReport(ctx, id, (await parseBody(req, reportUpdateSchema)).status);
});
