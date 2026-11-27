import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { cheatsQuery } from '@/modules/assessment/schemas';
import { listSuspicious } from '@/modules/assessment/service';


export const GET = handler(async (req) => {
  const ctx = await requireAdmin(req);
  return listSuspicious(ctx, parseQuery(req, cheatsQuery).limit);
});
