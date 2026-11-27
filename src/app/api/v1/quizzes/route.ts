import { requireAuth } from '@/lib/auth';
import { created, handler } from '@/lib/http';
import { parseBody, parseQuery } from '@/lib/validation';
import { quizCreateSchema, quizListQuery } from '@/modules/content/schemas';
import { createQuiz, listQuizzes } from '@/modules/content/service';


export const GET = handler(async (req) => listQuizzes(await requireAuth(req), parseQuery(req, quizListQuery)));





export const POST = handler(async (req) => {
  const ctx = await requireAuth(req, { roles: ['teacher', 'admin'] });
  return created(await createQuiz(ctx, await parseBody(req, quizCreateSchema)));
});
