import { handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { forgotSchema } from '@/modules/auth/schemas';
import { forgotPassword } from '@/modules/auth/service';

/** POST /api/auth/password/forgot — envía el correo de recuperación. */
export const POST = handler(async (req) => forgotPassword((await parseBody(req, forgotSchema)).email));
