import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseParam, uuid } from '@/lib/validation';
import { getMemoryMatch } from '@/modules/activities/service';


export const GET = handler<{ moduleId: string }>(async (req, { params }) =>
  getMemoryMatch(await requireAuth(req), parseParam((await params).moduleId, uuid)),
);
