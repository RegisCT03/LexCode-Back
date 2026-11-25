import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery, uuid } from '@/lib/validation';
import { suggestions } from '@/modules/lexis/service';

/** GET /api/lexis/suggestions?moduleId=… — preguntas sugeridas para el chat. */
export const GET = handler(async (req) => {
  const ctx = await requireAuth(req);
  const { moduleId } = parseQuery(req, z.object({ moduleId: uuid.optional() }));
  return suggestions(ctx, moduleId);
});
