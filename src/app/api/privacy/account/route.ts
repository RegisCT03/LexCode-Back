import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { requestDeletion } from '@/modules/privacy/service';

/** DELETE /api/privacy/account — elimina la cuenta con 30 días para recuperarla. */
export const DELETE = handler(async (req) => requestDeletion(await requireAuth(req)));
