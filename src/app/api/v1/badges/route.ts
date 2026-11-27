import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { badges } from '@/modules/gamification/service';


export const GET = handler(async (req) => badges(await requireAuth(req)));
