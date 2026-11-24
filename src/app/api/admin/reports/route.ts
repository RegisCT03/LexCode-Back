import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { reportsQuery } from '@/modules/admin/schemas';
import { listReports } from '@/modules/admin/service';

/** GET /api/admin/reports?status=&page= — reportes de contenido o conducta. */
export const GET = handler(async (req) => listReports(await requireAdmin(req), parseQuery(req, reportsQuery)));
