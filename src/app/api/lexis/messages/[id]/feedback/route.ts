import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam } from '@/lib/validation';
import { feedback, feedbackSchema } from '@/modules/lexis/service';

/** POST /api/lexis/messages/:id/feedback — ¿te sirvió la respuesta? */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAuth(req);
  const id = parseParam((await params).id, z.coerce.number().int().positive());
  return feedback(ctx, id, (await parseBody(req, feedbackSchema)).helpful);
});
