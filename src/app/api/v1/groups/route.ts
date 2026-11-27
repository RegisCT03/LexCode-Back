import { requireAuth } from '@/lib/auth';
import { created, handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { groupCreateSchema } from '@/modules/groups/schemas';
import { createGroup, listGroups } from '@/modules/groups/service';


export const GET = handler(async (req) => listGroups(await requireAuth(req)));


export const POST = handler(async (req) => {
  const ctx = await requireAuth(req, { roles: ['teacher', 'admin'] });
  return created(await createGroup(ctx, await parseBody(req, groupCreateSchema)));
});
