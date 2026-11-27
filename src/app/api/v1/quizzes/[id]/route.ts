import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { quizUpdateSchema } from '@/modules/content/schemas';
import { deleteQuiz, getQuiz, updateQuiz } from '@/modules/content/service';


export const GET = handler<{ id: string }>(async (req, { params }) =>
  getQuiz(await requireAuth(req), parseParam((await params).id, uuid)),
);


export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAuth(req, { roles: ['teacher', 'admin'] });
  const id = parseParam((await params).id, uuid);
  return updateQuiz(ctx, id, await parseBody(req, quizUpdateSchema));
});


export const DELETE = handler<{ id: string }>(async (req, { params }) =>
  deleteQuiz(await requireAuth(req, { roles: ['teacher', 'admin'] }), parseParam((await params).id, uuid)),
);
