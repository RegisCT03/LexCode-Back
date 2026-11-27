import type { z } from 'zod';
import type { AuthContext } from '@/lib/auth';
import { AppError, forbidden, notFound } from '@/lib/errors';
import { camelize } from '@/lib/format';
import { env } from '@/lib/env';
import { anonClient, serviceClient, unwrap } from '@/lib/supabase';
import { pageRange } from '@/lib/validation';
import { renderCertificate } from './pdf';
import type { adminListQuery } from './schemas';

const BUCKET = 'certificates';
const SIGNED_URL_TTL = 5 * 60; 

type Certificate = {
  id: string;
  student_id: string | null;
  folio: string;
  holder_name: string;
  final_score: number;
  pdf_path: string | null;
  issued_at: string;
  revoked: boolean;
  path: { title: string } | { title: string }[] | null;
};

const COLUMNS = 'id, student_id, folio, holder_name, final_score, pdf_path, issued_at, revoked, path:learning_paths(title)';
const pathTitle = (c: Certificate) => (Array.isArray(c.path) ? c.path[0]?.title : c.path?.title) ?? 'Ruta de aprendizaje';


export async function listMine({ db, userId }: AuthContext) {
  const rows = unwrap(await db.from('certificates').select(COLUMNS).eq('student_id', userId).order('issued_at', { ascending: false })) as unknown as Certificate[];
  return rows.map((c) => ({
    id: c.id,
    folio: c.folio,
    holderName: c.holder_name,
    pathTitle: pathTitle(c),
    finalScore: c.final_score,
    issuedAt: c.issued_at,
    revoked: c.revoked,
  }));
}






export async function download({ db, userId }: AuthContext, id: string) {
  const c = unwrap(await db.from('certificates').select(COLUMNS).eq('id', id).maybeSingle()) as unknown as Certificate;
  if (c.student_id !== userId) throw forbidden();
  if (c.revoked) throw new AppError(403, 'certificate_revoked', 'Esta constancia fue revocada');

  const admin = serviceClient();
  let path = c.pdf_path;
  if (!path) {
    const pdf = await renderCertificate({
      holderName: c.holder_name,
      pathTitle: pathTitle(c),
      finalScore: Number(c.final_score),
      issuedAt: c.issued_at,
      folio: c.folio,
      verifyUrl: `${env().FRONTEND_URL}/verificar/${c.folio}`,
    });
    path = `${userId}/${c.folio}.pdf`;
    const up = await admin.storage.from(BUCKET).upload(path, pdf, { contentType: 'application/pdf', upsert: true });
    if (up.error) throw new AppError(502, 'storage_unavailable', 'No se pudo guardar la constancia, inténtalo de nuevo', up.error);
    const saved = await admin.from('certificates').update({ pdf_path: path }).eq('id', c.id);
    if (saved.error) throw saved.error;
  }

  const signed = await db.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL, { download: `constancia-${c.folio}.pdf` });
  if (signed.error || !signed.data) throw new AppError(502, 'storage_unavailable', 'No se pudo generar el enlace de descarga');
  return { folio: c.folio, url: signed.data.signedUrl, expiresIn: SIGNED_URL_TTL };
}


export async function verify(folio: string) {
  const rows = unwrap(await anonClient().rpc('verify_certificate', { p_folio: folio })) as {
    holder_name: string;
    path_title: string;
    final_score: number;
    issued_at: string;
    is_valid: boolean;
  }[];
  if (!rows.length) throw notFound('No existe una constancia con ese folio');
  return { folio, ...camelize<Record<string, unknown>>(rows[0]) };
}



export async function adminList(_ctx: AuthContext, q: z.infer<typeof adminListQuery>) {
  const { from, to } = pageRange(q);
  let query = serviceClient()
    .from('certificates')
    .select('id, folio, holder_name, final_score, issued_at, revoked, student:profiles(username), path:learning_paths(title)', { count: 'exact' });
  if (q.revoked) query = query.eq('revoked', q.revoked === 'true');
  const { data, error, count } = await query.order('issued_at', { ascending: false }).range(from, to);
  if (error) throw error;
  return { items: camelize(data), total: count ?? 0, page: q.page, pageSize: q.pageSize };
}


export async function setRevoked(_ctx: AuthContext, id: string, revoked: boolean) {
  const { data, error } = await serviceClient().from('certificates').update({ revoked }).eq('id', id).select('id, folio, revoked');
  if (error) throw error;
  if (!data?.length) throw notFound('No existe esa constancia');
  return data[0];
}
