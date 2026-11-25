import { requireAuth } from '@/lib/auth';
import { clientIp, created, handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { consentSchema, myConsents, recordConsent } from '@/modules/privacy/service';

/** GET /api/privacy/consents — estado actual de mis consentimientos. */
export const GET = handler(async (req) => myConsents(await requireAuth(req)));

/** POST /api/privacy/consents — otorga o retira un consentimiento (finalidades secundarias, rankings públicos…). */
export const POST = handler(async (req) => {
  const ctx = await requireAuth(req);
  return created(await recordConsent(ctx, await parseBody(req, consentSchema), clientIp(req)));
});
