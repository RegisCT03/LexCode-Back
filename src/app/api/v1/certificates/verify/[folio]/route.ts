import { handler } from '@/lib/http';
import { parseParam } from '@/lib/validation';
import { folio } from '@/modules/certificates/schemas';
import { verify } from '@/modules/certificates/service';


export const GET = handler<{ folio: string }>(async (_req, { params }) => verify(parseParam((await params).folio, folio)));
