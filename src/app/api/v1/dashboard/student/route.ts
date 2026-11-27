import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { studentDashboard } from '@/modules/dashboards/service';


export const GET = handler(async (req) => studentDashboard(await requireAuth(req, { roles: ['student'] })));
