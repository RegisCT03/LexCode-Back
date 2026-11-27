import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { summaryQuery } from '@/modules/gamification/schemas';
import { summary } from '@/modules/gamification/service';


export const GET = handler(async (req) => summary(await requireAuth(req), parseQuery(req, summaryQuery)));
