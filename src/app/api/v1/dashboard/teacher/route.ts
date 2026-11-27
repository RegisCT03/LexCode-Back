import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { teacherDashboardQuery } from '@/modules/dashboards/schemas';
import { teacherDashboard } from '@/modules/dashboards/service';


export const GET = handler(async (req) => {
  const ctx = await requireAuth(req, { roles: ['teacher', 'admin'] });
  return teacherDashboard(ctx, parseQuery(req, teacherDashboardQuery));
});
