import { requireAdmin } from '@/lib/auth';
import { created, handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { dilemmaCreateSchema } from '@/modules/content/schemas';
import { adminListDilemmas, createDilemma } from '@/modules/content/service';


export const GET = handler(async (req) => adminListDilemmas(await requireAdmin(req)));


export const POST = handler(async (req) => {
  const ctx = await requireAdmin(req);
  return created(await createDilemma(ctx, await parseBody(req, dilemmaCreateSchema)));
});
