import { handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { refreshSchema } from '@/modules/auth/schemas';
import { refresh } from '@/modules/auth/service';

/** POST /api/auth/refresh — renueva el access token. */
export const POST = handler(async (req) => refresh((await parseBody(req, refreshSchema)).refreshToken));
