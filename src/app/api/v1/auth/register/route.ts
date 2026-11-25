import { created, handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { registerSchema } from '@/modules/auth/schemas';
import { register } from '@/modules/auth/service';

/** POST /api/auth/register — crea la cuenta (estudiante). */
export const POST = handler(async (req) => created(await register(await parseBody(req, registerSchema))));
