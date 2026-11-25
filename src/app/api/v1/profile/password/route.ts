import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { changePassword } from '@/modules/auth/service';
import { changePasswordSchema } from '@/modules/profile/service';

/** PATCH /api/profile/password — cambia la contraseña (pide la actual). */
export const PATCH = handler(async (req) => {
  const { userId, profile } = await requireAuth(req);
  const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema);
  return changePassword(profile.email, userId, currentPassword, newPassword);
});
