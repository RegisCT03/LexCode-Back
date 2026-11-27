import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { progressQuery } from '@/modules/progress/schemas';
import { getProgress } from '@/modules/progress/service';


export const GET = handler(async (req) => getProgress(await requireAuth(req), parseQuery(req, progressQuery)));
