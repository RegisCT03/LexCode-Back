import { requireAdmin } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody, parseParam, uuid } from '@/lib/validation';
import { glossaryUpdateSchema } from '@/modules/admin/schemas';
import { deleteTerm, updateTerm } from '@/modules/admin/service';

/** PATCH /api/admin/glossary/:id */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const ctx = await requireAdmin(req);
  const id = parseParam((await params).id, uuid);
  return updateTerm(ctx, id, await parseBody(req, glossaryUpdateSchema));
});

/** DELETE /api/admin/glossary/:id */
export const DELETE = handler<{ id: string }>(async (req, { params }) =>
  deleteTerm(await requireAdmin(req), parseParam((await params).id, uuid)),
);
