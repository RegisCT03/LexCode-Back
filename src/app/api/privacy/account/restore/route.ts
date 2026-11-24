import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { restoreAccount } from '@/modules/privacy/service';

/** POST /api/privacy/account/restore — recupera la cuenta dentro de los 30 días. */
export const POST = handler(async (req) => restoreAccount(await requireAuth(req, { statuses: ['deleted'] })));
