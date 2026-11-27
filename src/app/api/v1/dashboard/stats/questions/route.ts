import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { questionStatsQuery } from '@/modules/dashboards/schemas';
import { questionStats } from '@/modules/dashboards/service';


export const GET = handler(async (req) => {
  const ctx = await requireAuth(req, { roles: ['teacher', 'admin'] });
  return questionStats(ctx, parseQuery(req, questionStatsQuery).quizId);
});
