import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { ask, askSchema } from '@/modules/lexis/service';

/** POST /api/lexis/ask — pregunta a Lexis (respuestas predeterminadas). */
export const POST = handler(async (req) => {
  const ctx = await requireAuth(req);
  return ask(ctx, await parseBody(req, askSchema));
});
