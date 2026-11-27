import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseParam, uuid } from '@/lib/validation';
import { getDilemma } from '@/modules/content/service';


export const GET = handler<{ id: string }>(async (req, { params }) =>
  getDilemma(await requireAuth(req), parseParam((await params).id, uuid)),
);
