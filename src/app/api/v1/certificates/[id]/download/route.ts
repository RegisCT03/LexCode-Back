import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseParam, uuid } from '@/lib/validation';
import { download } from '@/modules/certificates/service';


export const runtime = 'nodejs';


export const GET = handler<{ id: string }>(async (req, { params }) =>
  download(await requireAuth(req, { roles: ['student'] }), parseParam((await params).id, uuid)),
);
