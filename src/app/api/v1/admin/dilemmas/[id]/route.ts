import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { dilemmaUpdateSchema } from '@/modules/content/schemas';
import { adminGetDilemma, deleteDilemma, updateDilemma } from '@/modules/content/service';


export const GET = handler<{ id: string }>(async (req, { params }) =>
  adminGetDilemma(await requireAdmin(req), parseParam((await params).id, uuid)),
);


export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAdmin(req);
  const id = parseParam((await params).id, uuid);
  return updateDilemma(ctx, id, await parseBody(req, dilemmaUpdateSchema));
});


export const DELETE = handler<{ id: string }>(async (req, { params }) =>
  deleteDilemma(await requireAdmin(req), parseParam((await params).id, uuid)),
);
