import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { resendGuardianEmail } from '@/modules/auth/service';

/** POST /api/auth/guardian/resend — reenvía el correo de autorización al tutor. */
export const POST = handler(async (req) => {
  const { userId, profile } = await requireAuth(req, { statuses: ['pending_guardian'] });
  return resendGuardianEmail(userId, profile.full_name);
});
