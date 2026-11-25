import { handler } from '@/lib/http';
import { listLegalDocuments } from '@/modules/privacy/service';

/** GET /api/privacy/documents — Aviso de Privacidad y Términos vigentes (público). */
export const GET = handler(async () => listLegalDocuments());
