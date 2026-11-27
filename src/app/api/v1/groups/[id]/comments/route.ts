import { requireAuth } from '@/lib/auth';
import { created, handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { commentSchema } from '@/modules/groups/schemas';
import { addComment } from '@/modules/groups/service';


export const POST = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAuth(req, { roles: ['teacher'] });
  const id = parseParam((await params).id, uuid);
  return created(await addComment(ctx, id, await parseBody(req, commentSchema)));
});
