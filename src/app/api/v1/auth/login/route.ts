import { handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { loginSchema } from '@/modules/auth/schemas';
import { login } from '@/modules/auth/service';

/** POST /api/auth/login — devuelve tokens y el perfil básico. */
export const POST = handler(async (req) => {
  const { email, password } = await parseBody(req, loginSchema);
  return login(email, password);
});
