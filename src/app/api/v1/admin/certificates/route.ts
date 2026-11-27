import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { adminListQuery } from '@/modules/certificates/schemas';
import { adminList } from '@/modules/certificates/service';


export const GET = handler(async (req) => {
  const ctx = await requireAdmin(req);
  return adminList(ctx, parseQuery(req, adminListQuery));
});
