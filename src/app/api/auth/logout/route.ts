import { bearerToken } from '@/lib/auth';
import { unauthorized } from '@/lib/errors';
import { handler } from '@/lib/http';
import { logout } from '@/modules/auth/service';

/** POST /api/auth/logout — cierra la sesión actual. */
export const POST = handler(async (req) => {
  const token = bearerToken(req);
  if (!token) throw unauthorized();
  return logout(token);
});
