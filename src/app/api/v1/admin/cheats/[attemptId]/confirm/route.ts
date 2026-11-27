import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseParam, uuid } from '@/lib/validation';
import { confirmCheat } from '@/modules/assessment/service';


export const POST = handler<{ attemptId: string }>(async (req, { params }) => {
  const ctx = await requireAdmin(req);
  return confirmCheat(ctx, parseParam((await params).attemptId, uuid));
});
