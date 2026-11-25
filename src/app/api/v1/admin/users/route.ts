import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { usersQuery } from '@/modules/admin/schemas';
import { listUsers } from '@/modules/admin/service';

/** GET /api/admin/users?role=&status=&q=&page=&pageSize= */
export const GET = handler(async (req) => listUsers(await requireAdmin(req), parseQuery(req, usersQuery)));
