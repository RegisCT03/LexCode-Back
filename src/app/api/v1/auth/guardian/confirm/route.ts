import { handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { guardianConfirmSchema } from '@/modules/auth/schemas';
import { confirmGuardian } from '@/modules/auth/service';

/** POST /api/auth/guardian/confirm — el tutor autoriza la cuenta (token del correo). */
export const POST = handler(async (req) => confirmGuardian((await parseBody(req, guardianConfirmSchema)).token));
