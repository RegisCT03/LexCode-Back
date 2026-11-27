import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { xpHistoryQuery } from '@/modules/gamification/schemas';
import { xpHistory } from '@/modules/gamification/service';


export const GET = handler(async (req) => xpHistory(await requireAuth(req, { roles: ['student'] }), parseQuery(req, xpHistoryQuery)));
