import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { reminders } from '@/modules/dashboards/service';


export const GET = handler(async (req) => reminders(await requireAuth(req, { roles: ['student'] })));
