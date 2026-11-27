import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { listPaths } from '@/modules/content/service';


export const GET = handler(async (req) => listPaths(await requireAuth(req)));
