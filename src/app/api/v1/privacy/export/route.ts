import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { exportMyData } from '@/modules/privacy/service';

/** GET /api/privacy/export — descarga de mis datos personales en JSON (derecho de acceso). */
export const GET = handler(async (req) => {
  const ctx = await requireAuth(req, { statuses: ['active', 'deleted'] });
  const data = await exportMyData(ctx);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="lexcode-mis-datos-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});
