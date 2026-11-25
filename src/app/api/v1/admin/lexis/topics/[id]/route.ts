import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { topicUpdateSchema } from '@/modules/admin/schemas';
import { deleteTopic, updateTopic } from '@/modules/admin/service';

/** PATCH /api/admin/lexis/topics/:id */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAdmin(req);
  const id = parseParam((await params).id, uuid);
  return updateTopic(ctx, id, await parseBody(req, topicUpdateSchema));
});

/** DELETE /api/admin/lexis/topics/:id */
export const DELETE = handler<{ id: string }>(async (req, { params }) =>
  deleteTopic(await requireAdmin(req), parseParam((await params).id, uuid)),
);
