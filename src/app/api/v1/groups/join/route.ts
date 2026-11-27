import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { joinSchema } from '@/modules/groups/schemas';
import { joinGroup } from '@/modules/groups/service';


export const POST = handler(async (req) => {
  const ctx = await requireAuth(req, { roles: ['student'] });
  return joinGroup(ctx, await parseBody(req, joinSchema));
});
