import { requireAdmin } from '@/lib/auth';
import { created, handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { answerSchema } from '@/modules/admin/schemas';
import { publishAnswer } from '@/modules/admin/service';

/** POST /api/admin/lexis/topics/:id/answers — publica una nueva versión de la respuesta. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAdmin(req);
  const id = parseParam((await params).id, uuid);
  return created(await publishAnswer(ctx, id, await parseBody(req, answerSchema)));
});
