import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { listMine } from '@/modules/certificates/service';


export const GET = handler(async (req) => listMine(await requireAuth(req, { roles: ['student'] })));
