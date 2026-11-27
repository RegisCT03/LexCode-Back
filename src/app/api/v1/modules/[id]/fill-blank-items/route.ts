import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { fillBlankSchema } from '@/modules/activities/schemas';
import { getEditableFillBlank, saveFillBlank } from '@/modules/activities/service';


export const GET = handler<{ id: string }>(async (req, { params }) =>
  getEditableFillBlank(await requireAuth(req, { roles: ['teacher', 'admin'] }), parseParam((await params).id, uuid)),
);


export const PUT = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAuth(req, { roles: ['teacher', 'admin'] });
  return saveFillBlank(ctx, parseParam((await params).id, uuid), await parseBody(req, fillBlankSchema));
});
