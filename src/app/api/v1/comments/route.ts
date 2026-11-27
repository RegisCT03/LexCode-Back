import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { commentsQuery } from '@/modules/groups/schemas';
import { listComments } from '@/modules/groups/service';


export const GET = handler(async (req) => listComments(await requireAuth(req), parseQuery(req, commentsQuery)));
