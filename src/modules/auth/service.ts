import type { Session } from '@supabase/supabase-js';
import { PROFILE_SESSION_COLUMNS, type SessionProfile } from '@/lib/auth';
import { signToken, verifyToken } from '@/lib/crypto';
import { env } from '@/lib/env';
import { AppError, badRequest, conflict, fromAuth } from '@/lib/errors';
import { escapeHtml, sendMail } from '@/lib/mailer';
import { anonClient, serviceClient, unwrap, userClient } from '@/lib/supabase';
import { ageOn, type RegisterInput } from './schemas';

const GUARDIAN_TOKEN_TTL = 7 * 24 * 3600; // 7 días

export interface SessionDto {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  tokenType: string;
}

const toSession = (s: Session): SessionDto => ({
  accessToken: s.access_token,
  refreshToken: s.refresh_token,
  expiresAt: s.expires_at ?? null,
  tokenType: s.token_type,
});

/** Versiones vigentes del Aviso de Privacidad y de los Términos. */
export async function currentLegalVersions(): Promise<{ privacy: string; terms: string }> {
  const docs = unwrap(
    await serviceClient()
      .from('legal_documents')
      .select('type, version, effective_at')
      .lte('effective_at', new Date().toISOString().slice(0, 10))
      .order('effective_at', { ascending: false }),
  ) as { type: string; version: string }[];
  const privacy = docs.find((d) => d.type === 'privacy_notice')?.version;
  const terms = docs.find((d) => d.type === 'terms')?.version;
  if (!privacy || !terms) throw new AppError(500, 'legal_documents_missing', 'No hay documentos legales vigentes');
  return { privacy, terms };
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { count, error } = await serviceClient()
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('username', username);
  if (error) throw error;
  return (count ?? 0) === 0;
}

export async function register(input: RegisterInput) {
  // Se valida aquí para dar mensajes claros: si el trigger de la base rechaza
  // el registro, Supabase Auth solo devuelve un error genérico.
  const age = ageOn(input.birthDate);
  if (age < 13) throw new AppError(422, 'underage', 'LexCode no admite cuentas de menores de 13 años');
  if (age > 100) throw badRequest('Revisa tu fecha de nacimiento', { fields: { birthDate: 'Fecha no válida' } });
  const isMinor = age < 18;
  if (isMinor && !input.guardianEmail) {
    throw badRequest('Las personas de 13 a 17 años necesitan el correo de su madre, padre o tutor', {
      fields: { guardianEmail: 'Obligatorio para menores de edad' },
    });
  }
  if (!(await isUsernameAvailable(input.username))) throw conflict('Ese nombre de usuario ya está en uso', 'username_taken');

  const versions = await currentLegalVersions();
  const { data, error } = await anonClient().auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${env().FRONTEND_URL}/auth/confirmado`,
      data: {
        full_name: input.fullName,
        username: input.username,
        birth_date: input.birthDate,
        guardian_email: isMinor ? input.guardianEmail : undefined,
        privacy_version: versions.privacy,
        terms_version: versions.terms,
        secondary_purposes: input.secondaryPurposes,
      },
    },
  });
  if (error) throw fromAuth(error);
  if (!data.user) throw new AppError(502, 'auth_unavailable', 'No se pudo crear la cuenta');
  // Con confirmación de correo activa, Supabase no revela si el correo ya existía:
  // devuelve un usuario sin identidades.
  if (data.user.identities && data.user.identities.length === 0) {
    throw conflict('Ya existe una cuenta con ese correo', 'user_already_exists');
  }

  if (isMinor) await sendGuardianEmail(data.user.id, input.fullName, input.guardianEmail!);

  return {
    userId: data.user.id,
    status: isMinor ? 'pending_guardian' : 'active',
    emailConfirmationRequired: !data.session,
    session: data.session ? toSession(data.session) : null,
  };
}

async function sendGuardianEmail(userId: string, studentName: string, guardianEmail: string) {
  const token = signToken({ uid: userId, ge: guardianEmail, p: 'guardian' }, GUARDIAN_TOKEN_TTL);
  const link = `${env().FRONTEND_URL}/autorizar-tutor?token=${encodeURIComponent(token)}`;
  const name = escapeHtml(studentName);
  await sendMail({
    to: guardianEmail,
    subject: `Autoriza la cuenta de ${studentName} en LexCode`,
    text:
      `${studentName} creó una cuenta en LexCode, una plataforma educativa sobre ética, ` +
      `legislación de TI y ciberseguridad. Como es menor de edad necesitamos tu autorización.\n\n` +
      `Autorizar la cuenta: ${link}\n\nEl enlace vence en 7 días. Si no reconoces este registro, ignora este correo.`,
    html:
      `<p><strong>${name}</strong> creó una cuenta en LexCode, una plataforma educativa sobre ética, ` +
      `legislación de TI y ciberseguridad. Como es menor de edad necesitamos tu autorización.</p>` +
      `<p><a href="${link}">Autorizar la cuenta</a></p>` +
      `<p>El enlace vence en 7 días. Si no reconoces este registro, ignora este correo.</p>`,
  });
}

/** El tutor abre el enlace del correo; el frontend manda el token aquí. */
export async function confirmGuardian(token: string) {
  const payload = verifyToken<{ uid: string; ge: string; p: string }>(token);
  if (!payload || payload.p !== 'guardian') {
    throw new AppError(400, 'invalid_token', 'El enlace no es válido o ya venció');
  }
  const { error } = await serviceClient().rpc('authorize_guardian', {
    p_user_id: payload.uid,
    p_guardian_email: payload.ge,
  });
  if (error) throw error;
  return { authorized: true };
}

/** Reenvía el correo al tutor (la cuenta debe seguir pendiente). */
export async function resendGuardianEmail(userId: string, fullName: string) {
  const { data, error } = await serviceClient().auth.admin.getUserById(userId);
  if (error) throw fromAuth(error);
  const guardianEmail = data.user?.user_metadata?.guardian_email as string | undefined;
  if (!guardianEmail) throw new AppError(422, 'business_rule', 'La cuenta no tiene correo de tutor');
  await sendGuardianEmail(userId, fullName, guardianEmail);
  return { sent: true };
}

export async function login(email: string, password: string) {
  const sb = anonClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw fromAuth(error);
  const profile = unwrap(
    await userClient(data.session.access_token)
      .from('profiles')
      .select(PROFILE_SESSION_COLUMNS)
      .eq('id', data.user.id)
      .single<SessionProfile>(),
  );
  // Las cuentas suspendidas no reciben sesión.
  if (profile.status === 'suspended') {
    await serviceClient().auth.admin.signOut(data.session.access_token, 'local');
    throw new AppError(403, 'account_suspended', 'Tu cuenta está suspendida. Escribe a soporte');
  }
  return { session: toSession(data.session), profile };
}

export async function refresh(refreshToken: string) {
  const { data, error } = await anonClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error) throw fromAuth(error);
  if (!data.session) throw new AppError(401, 'session_expired', 'Tu sesión expiró, vuelve a iniciar sesión');
  return { session: toSession(data.session) };
}

export async function logout(accessToken: string) {
  const { error } = await serviceClient().auth.admin.signOut(accessToken, 'local');
  if (error && error.status !== 404 && error.status !== 401) throw fromAuth(error);
  return { loggedOut: true };
}

export async function forgotPassword(email: string) {
  const { error } = await anonClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${env().FRONTEND_URL}/auth/restablecer`,
  });
  // No se revela si el correo existe; solo se reportan límites de envío.
  if (error && error.code?.startsWith('over_')) throw fromAuth(error);
  return { sent: true };
}

/** El token de recuperación llega al frontend en el enlace del correo. */
export async function resetPassword(recoveryAccessToken: string, newPassword: string) {
  const { data, error } = await anonClient().auth.getClaims(recoveryAccessToken);
  const claims = data?.claims;
  if (error || !claims?.sub) throw new AppError(401, 'session_expired', 'El enlace expiró, solicita uno nuevo');
  // Solo una sesión abierta desde el correo de recuperación puede cambiar la
  // contraseña sin la actual (si no, un token robado bastaría para secuestrar la cuenta).
  const methods = (claims.amr as { method: string }[] | undefined)?.map((a) => a.method) ?? [];
  if (!methods.some((m) => m === 'recovery' || m === 'otp')) {
    throw new AppError(403, 'recovery_required', 'Abre el enlace que te enviamos por correo para cambiar la contraseña');
  }
  const { error: updateError } = await serviceClient().auth.admin.updateUserById(claims.sub, { password: newPassword });
  if (updateError) throw fromAuth(updateError);
  return { updated: true };
}

/** Cambio de contraseña con sesión normal: exige la contraseña actual. */
export async function changePassword(email: string, userId: string, currentPassword: string, newPassword: string) {
  if (currentPassword === newPassword) {
    throw new AppError(400, 'same_password', 'La nueva contraseña debe ser diferente a la actual');
  }
  const { error } = await anonClient().auth.signInWithPassword({ email, password: currentPassword });
  if (error) {
    if (error.code === 'invalid_credentials') throw new AppError(400, 'wrong_password', 'La contraseña actual no es correcta');
    throw fromAuth(error);
  }
  const { error: updateError } = await serviceClient().auth.admin.updateUserById(userId, { password: newPassword });
  if (updateError) throw fromAuth(updateError);
  return { updated: true };
}
