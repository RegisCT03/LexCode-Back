import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseParam, uuid } from '@/lib/validation';
import { getAttempt } from '@/modules/assessment/service';


export const GET = handler<{ id: string }>(async (req, { params }) =>
  getAttempt(await requireAuth(req, { roles: ['student'] }), parseParam((await params).id, uuid)),
);
