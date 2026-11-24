import { z } from 'zod';
import type { AuthContext } from '@/lib/auth';
import { hashIp } from '@/lib/crypto';
import { AppError } from '@/lib/errors';
import { anonClient, unwrap } from '@/lib/supabase';
import { email } from '@/modules/auth/schemas';
import { currentLegalVersions } from '@/modules/auth/service';

export const ARCO_RIGHTS = ['access', 'rectification', 'cancellation', 'opposition', 'revocation'] as const;

export const consentSchema = z.object({
  type: z.enum(['privacy_notice', 'terms', 'secondary_purposes', 'public_rankings']),
  granted: z.boolean(),
});

export const arcoSchema = z.object({
  right: z.enum(ARCO_RIGHTS),
  description: z.string().trim().min(10, 'Describe tu solicitud (mínimo 10 caracteres)').max(4000),
  contactEmail: email.optional(),
});

/** Documentos legales publicados (vigentes y anteriores). No requiere sesión. */
export async function listLegalDocuments() {
  const docs = unwrap(
    await anonClient()
      .from('legal_documents')
      .select('id, type, version, title, content_url, effective_at')
      .order('effective_at', { ascending: false }),
  ) as { type: string; effective_at: string }[];
  const today = new Date().toISOString().slice(0, 10);
  const current = (type: string) => docs.find((d) => d.type === type && d.effective_at <= today) ?? null;
  return { current: { privacyNotice: current('privacy_notice'), terms: current('terms') }, all: docs };
}

export async function myConsents({ db }: AuthContext) {
  return unwrap(await db.rpc('my_consents'));
}

export async function recordConsent(ctx: AuthContext, input: z.infer<typeof consentSchema>, ip: string | null) {
  if ((input.type === 'privacy_notice' || input.type === 'terms') && !input.granted) {
    // Retirar el consentimiento del aviso o los términos equivale a cancelar la cuenta.
    throw new AppError(422, 'business_rule', 'Para dejar de aceptar el Aviso o los Términos, solicita la eliminación de tu cuenta');
  }
  const versions = await currentLegalVersions();
  const version = input.type === 'terms' ? versions.terms : versions.privacy;
  const id = unwrap(
    await ctx.db.rpc('record_consent', {
      p_type: input.type,
      p_version: version,
      p_granted: input.granted,
      p_ip_hash: hashIp(ip),
    }),
  );
  return { id, type: input.type, version, granted: input.granted };
}

export async function myArcoRequests({ db, userId }: AuthContext) {
  return unwrap(
    await db
      .from('arco_requests')
      .select('id, folio, right, description, status, received_at, due_date, responded_at, response')
      .eq('user_id', userId)
      .order('received_at', { ascending: false }),
  );
}

export async function createArcoRequest(ctx: AuthContext, input: z.infer<typeof arcoSchema>) {
  const { db, profile } = ctx;
  const { error } = await db.from('arco_requests').insert({
    right: input.right,
    description: input.description,
    contact_email: input.contactEmail ?? profile.email,
  });
  if (error) throw error;
  // El folio y la fecha límite los asigna la base; se lee la solicitud recién creada.
  const rows = unwrap(
    await db
      .from('arco_requests')
      .select('id, folio, right, description, status, received_at, due_date')
      .eq('user_id', ctx.userId)
      .order('received_at', { ascending: false })
      .limit(1),
  );
  return rows[0];
}

export async function exportMyData({ db }: AuthContext) {
  return unwrap(await db.rpc('export_my_data'));
}

export async function requestDeletion({ db }: AuthContext) {
  const purgeAt = unwrap(await db.rpc('request_account_deletion'));
  return { status: 'deleted', purgeAt };
}

export async function restoreAccount({ db }: AuthContext) {
  const { error } = await db.rpc('restore_account');
  if (error) throw error;
  return { status: 'active' };
}
