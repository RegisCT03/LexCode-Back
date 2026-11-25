import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';

/**
 * GET /api/auth/me — perfil de la sesión. Responde aunque la cuenta esté
 * pendiente o eliminada, para que el frontend muestre la pantalla adecuada.
 */
export const GET = handler(async (req) => {
  const { profile } = await requireAuth(req, { statuses: ['active', 'pending_guardian', 'deleted'] });
  return profile;
});
