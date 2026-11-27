import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseParam, uuid } from '@/lib/validation';
import { getEditableQuiz } from '@/modules/content/service';


export const GET = handler<{ id: string }>(async (req, { params }) =>
  getEditableQuiz(await requireAuth(req, { roles: ['teacher', 'admin'] }), parseParam((await params).id, uuid)),
);
