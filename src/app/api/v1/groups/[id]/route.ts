import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { groupUpdateSchema } from '@/modules/groups/schemas';
import { getGroup, updateGroup } from '@/modules/groups/service';


export const GET = handler<{ id: string }>(async (req, { params }) =>
  getGroup(await requireAuth(req), parseParam((await params).id, uuid)),
);


export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAuth(req, { roles: ['teacher', 'admin'] });
  const id = parseParam((await params).id, uuid);
  return updateGroup(ctx, id, await parseBody(req, groupUpdateSchema));
});
