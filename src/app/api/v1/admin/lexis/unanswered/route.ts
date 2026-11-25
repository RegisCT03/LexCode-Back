import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { unansweredQuery } from '@/modules/admin/schemas';
import { unanswered } from '@/modules/admin/service';

/** GET /api/admin/lexis/unanswered?limit= — preguntas que Lexis no supo responder (sin datos de quién). */
export const GET = handler(async (req) =>
  unanswered(await requireAdmin(req), parseQuery(req, unansweredQuery).limit),
);
