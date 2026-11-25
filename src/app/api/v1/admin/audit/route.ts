import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { auditQuery } from '@/modules/admin/schemas';
import { listAudit } from '@/modules/admin/service';

/** GET /api/admin/audit?table=&action=&actorId=&recordId=&page= — bitácora de cambios. */
export const GET = handler(async (req) => listAudit(await requireAdmin(req), parseQuery(req, auditQuery)));
