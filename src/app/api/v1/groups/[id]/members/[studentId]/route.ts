import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseParam, uuid } from '@/lib/validation';
import { removeMember } from '@/modules/groups/service';


export const DELETE = handler<{ id: string; studentId: string }>(async (req, { params }) => {
  const ctx = await requireAuth(req, { roles: ['teacher', 'admin'] });
  const p = await params;
  return removeMember(ctx, parseParam(p.id, uuid), parseParam(p.studentId, uuid));
});
