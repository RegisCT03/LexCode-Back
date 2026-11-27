import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseParam, uuid } from '@/lib/validation';
import { finishAttempt } from '@/modules/assessment/service';


export const POST = handler<{ id: string }>(async (req, { params }) =>
  finishAttempt(await requireAuth(req, { roles: ['student'] }), parseParam((await params).id, uuid)),
);
