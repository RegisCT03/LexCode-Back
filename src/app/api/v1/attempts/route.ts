import { requireAuth } from '@/lib/auth';
import { created, handler } from '@/lib/http';
import { parseBody, parseQuery } from '@/lib/validation';
import { historyQuery, startSchema } from '@/modules/assessment/schemas';
import { history, startAttempt } from '@/modules/assessment/service';


export const GET = handler(async (req) => history(await requireAuth(req, { roles: ['student'] }), parseQuery(req, historyQuery)));





export const POST = handler(async (req) => {
  const ctx = await requireAuth(req, { roles: ['student'] });
  return created(await startAttempt(ctx, await parseBody(req, startSchema)));
});
