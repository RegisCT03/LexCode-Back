import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseParam } from '@/lib/validation';
import { getTerm } from '@/modules/glossary/service';

/** GET /api/glossary/:slug — detalle de un término con su referencia legal. */
export const GET = handler<{ slug: string }>(async (req, { params }) => {
  const ctx = await requireAuth(req);
  return getTerm(ctx, parseParam((await params).slug, z.string().regex(/^[a-z0-9-]{1,80}$/)));
});
