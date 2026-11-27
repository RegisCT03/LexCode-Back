import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { memoryPairsSchema } from '@/modules/activities/schemas';
import { getEditableMemory, saveMemoryPairs } from '@/modules/activities/service';


export const GET = handler<{ id: string }>(async (req, { params }) =>
  getEditableMemory(await requireAuth(req, { roles: ['teacher', 'admin'] }), parseParam((await params).id, uuid)),
);


export const PUT = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAuth(req, { roles: ['teacher', 'admin'] });
  return saveMemoryPairs(ctx, parseParam((await params).id, uuid), await parseBody(req, memoryPairsSchema));
});
