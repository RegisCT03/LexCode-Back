import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { catalog } from '@/modules/activities/service';


export const GET = handler(async (req) => catalog(await requireAuth(req)));
