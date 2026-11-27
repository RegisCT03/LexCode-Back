import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { pathStats } from '@/modules/dashboards/service';


export const GET = handler(async (req) => pathStats(await requireAuth(req, { roles: ['teacher', 'admin'] })));
