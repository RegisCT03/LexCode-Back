import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseParam, uuid } from '@/lib/validation';
import { getModule } from '@/modules/content/service';


export const GET = handler<{ id: string }>(async (req, { params }) =>
  getModule(await requireAuth(req), parseParam((await params).id, uuid)),
);
