import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { arcoQuery } from '@/modules/admin/schemas';
import { listArco } from '@/modules/admin/service';

/** GET /api/admin/arco?status=&page= — solicitudes ARCO ordenadas por fecha límite. */
export const GET = handler(async (req) => listArco(await requireAdmin(req), parseQuery(req, arcoQuery)));
