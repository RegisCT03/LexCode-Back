import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseParam, uuid } from '@/lib/validation';
import { getUser } from '@/modules/admin/service';

/** GET /api/admin/users/:id — perfil y consentimientos. */
export const GET = handler<{ id: string }>(async (req, { params }) =>
  getUser(await requireAdmin(req), parseParam((await params).id, uuid)),
);
