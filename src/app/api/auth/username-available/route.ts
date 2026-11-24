import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { usernameQuery } from '@/modules/auth/schemas';
import { isUsernameAvailable } from '@/modules/auth/service';

/** GET /api/auth/username-available?username=… — para validar el formulario de registro. */
export const GET = handler(async (req) => {
  const { username } = parseQuery(req, usernameQuery);
  return { username, available: await isUsernameAvailable(username) };
});
