import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { getProfile, updateProfile, updateProfileSchema } from '@/modules/profile/service';

/** GET /api/profile — perfil completo de la sesión. */
export const GET = handler(async (req) => getProfile(await requireAuth(req)));

/** PATCH /api/profile — edita nombre, usuario, carrera, semestre, matrícula, área de interés o modo sin tiempo. */
export const PATCH = handler(async (req) => {
  const ctx = await requireAuth(req);
  return updateProfile(ctx, await parseBody(req, updateProfileSchema));
});
