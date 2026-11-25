import { requireAdmin } from '@/lib/auth';
import { created, handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { topicCreateSchema } from '@/modules/admin/schemas';
import { createTopic, listTopics } from '@/modules/admin/service';

/** GET /api/admin/lexis/topics — temas con todas sus versiones de respuesta. */
export const GET = handler(async (req) => listTopics(await requireAdmin(req)));

/** POST /api/admin/lexis/topics — nuevo tema (opcionalmente con su primera respuesta). */
export const POST = handler(async (req) => {
  const ctx = await requireAdmin(req);
  return created(await createTopic(ctx, await parseBody(req, topicCreateSchema)));
});
