import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { publicRankingQuery } from '@/modules/gamification/schemas';
import { publicRanking } from '@/modules/gamification/service';


export const GET = handler(async (req) => publicRanking(await requireAuth(req), parseQuery(req, publicRankingQuery).limit));
