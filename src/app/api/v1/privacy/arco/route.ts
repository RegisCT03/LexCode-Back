import { requireAuth } from '@/lib/auth';
import { created, handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { arcoSchema, createArcoRequest, myArcoRequests } from '@/modules/privacy/service';

const statuses = ['active', 'deleted'] as const;

/** GET /api/privacy/arco — mis solicitudes ARCO. */
export const GET = handler(async (req) => myArcoRequests(await requireAuth(req, { statuses: [...statuses] })));

/** POST /api/privacy/arco — nueva solicitud (acceso, rectificación, cancelación, oposición, revocación). */
export const POST = handler(async (req) => {
  const ctx = await requireAuth(req, { statuses: [...statuses] });
  return created(await createArcoRequest(ctx, await parseBody(req, arcoSchema)));
});
