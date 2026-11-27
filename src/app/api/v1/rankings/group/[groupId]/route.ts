import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseParam, uuid } from '@/lib/validation';
import { groupRanking } from '@/modules/gamification/service';


export const GET = handler<{ groupId: string }>(async (req, { params }) =>
  groupRanking(await requireAuth(req), parseParam((await params).groupId, uuid)),
);
