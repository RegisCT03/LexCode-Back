import { requireAdmin } from '@/lib/auth';
import { created, handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { legalDocumentSchema } from '@/modules/admin/schemas';
import { createLegalDocument } from '@/modules/admin/service';

/** POST /api/admin/legal-documents — publica una nueva versión del Aviso o de los Términos. */
export const POST = handler(async (req) => {
  const ctx = await requireAdmin(req);
  return created(await createLegalDocument(ctx, await parseBody(req, legalDocumentSchema)));
});
