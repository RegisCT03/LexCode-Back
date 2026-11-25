import { bearerToken } from '@/lib/auth';
import { unauthorized } from '@/lib/errors';
import { handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { resetSchema } from '@/modules/auth/schemas';
import { resetPassword } from '@/modules/auth/service';

/**
 * POST /api/auth/password/reset — nueva contraseña con el token de
 * recuperación (Authorization: Bearer <access_token del enlace del correo>).
 */
export const POST = handler(async (req) => {
  const token = bearerToken(req);
  if (!token) throw unauthorized('Abre el enlace que te enviamos por correo');
  return resetPassword(token, (await parseBody(req, resetSchema)).password);
});
