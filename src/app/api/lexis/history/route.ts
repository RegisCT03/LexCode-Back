import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { pagination, parseQuery } from '@/lib/validation';
import { clearHistory, history } from '@/modules/lexis/service';

/** GET /api/lexis/history?page=&pageSize= — mis conversaciones con Lexis. */
export const GET = handler(async (req) => history(await requireAuth(req), parseQuery(req, pagination)));

/** DELETE /api/lexis/history — borra mi historial con Lexis. */
export const DELETE = handler(async (req) => clearHistory(await requireAuth(req)));
