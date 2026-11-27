import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { revokeSchema } from '@/modules/certificates/schemas';
import { setRevoked } from '@/modules/certificates/service';


export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAdmin(req);
  const id = parseParam((await params).id, uuid);
  return setRevoked(ctx, id, (await parseBody(req, revokeSchema)).revoked);
});
