import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseParam, uuid } from '@/lib/validation';
import { removeMember } from '@/modules/groups/service';


export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAuth(req, { roles: ['student'] });
  return removeMember(ctx, parseParam((await params).id, uuid), ctx.userId);
});
