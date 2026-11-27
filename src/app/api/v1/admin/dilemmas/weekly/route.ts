import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { weeklyDilemmaSchema } from '@/modules/content/schemas';
import { setWeeklyDilemma } from '@/modules/content/service';


export const PUT = handler(async (req) => {
  const ctx = await requireAdmin(req);
  return setWeeklyDilemma(ctx, await parseBody(req, weeklyDilemmaSchema));
});
