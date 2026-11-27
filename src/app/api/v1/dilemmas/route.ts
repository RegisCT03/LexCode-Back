import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { listDilemmas } from '@/modules/content/service';


export const GET = handler(async (req) => listDilemmas(await requireAuth(req)));
