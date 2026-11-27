import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseParam, uuid } from '@/lib/validation';
import { getModuleProgress } from '@/modules/progress/service';


export const GET = handler<{ id: string }>(async (req, { params }) =>
  getModuleProgress(await requireAuth(req, { roles: ['student'] }), parseParam((await params).id, uuid)),
);
