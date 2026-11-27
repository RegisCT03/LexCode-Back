import { requireAuth } from '@/lib/auth';
import { created, handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { answerSchemas } from '@/modules/assessment/schemas';
import { answer, attemptActivity } from '@/modules/assessment/service';









export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAuth(req, { roles: ['student'] });
  const id = parseParam((await params).id, uuid);
  const activity = await attemptActivity(ctx, id);
  return created(await answer(ctx, id, activity, await parseBody(req, answerSchemas[activity])));
});
