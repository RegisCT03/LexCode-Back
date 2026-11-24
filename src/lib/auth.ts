import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { forbidden, unauthorized } from './errors';
import { userClient } from './supabase';

export type Role = 'student' | 'teacher' | 'admin';
export type AccountStatus = 'pending_guardian' | 'active' | 'suspended' | 'deleted';

export interface SessionProfile {
  id: string;
  full_name: string;
  username: string;
  email: string;
  role: Role;
  status: AccountStatus;
  avatar_url: string | null;
  level: number;
  xp_total: number;
}

export interface AuthContext {
  userId: string;
  token: string;
  profile: SessionProfile;
  /** Cliente de Supabase con la sesión del usuario (RLS activo). */
  db: SupabaseClient;
}

interface Options {
  /** Roles permitidos. Por defecto, cualquiera. */
  roles?: Role[];
  /** Estados de cuenta permitidos. Por defecto solo `active`. */
  statuses?: AccountStatus[];
}

const STATUS_ERRORS: Record<Exclude<AccountStatus, 'active'>, [string, string]> = {
  pending_guardian: ['account_pending_guardian', 'Tu cuenta espera la autorización de tu madre, padre o tutor'],
  suspended: ['account_suspended', 'Tu cuenta está suspendida. Escribe a soporte'],
  deleted: ['account_deleted', 'Tu cuenta está en proceso de eliminación. Puedes recuperarla'],
};

export const PROFILE_SESSION_COLUMNS = 'id, full_name, username, email, role, status, avatar_url, level, xp_total';

export function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * Valida el access token de Supabase (Authorization: Bearer …), carga el perfil
 * y revisa rol y estado de la cuenta.
 */
export async function requireAuth(req: NextRequest, opts: Options = {}): Promise<AuthContext> {
  const token = bearerToken(req);
  if (!token) throw unauthorized();

  const db = userClient(token);
  const { data: claimsData, error: claimsError } = await db.auth.getClaims(token);
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) throw unauthorized('Tu sesión expiró, vuelve a iniciar sesión', 'session_expired');

  const { data: profile, error } = await db
    .from('profiles')
    .select(PROFILE_SESSION_COLUMNS)
    .eq('id', userId)
    .maybeSingle<SessionProfile>();
  if (error) throw error;
  if (!profile) throw unauthorized('Tu cuenta no tiene perfil', 'profile_missing');

  const statuses = opts.statuses ?? ['active'];
  if (!statuses.includes(profile.status)) {
    const [code, message] = STATUS_ERRORS[profile.status as Exclude<AccountStatus, 'active'>] ?? [
      'account_inactive',
      'Tu cuenta no está activa',
    ];
    throw forbidden(message, code);
  }
  if (opts.roles && !opts.roles.includes(profile.role)) throw forbidden();

  return { userId, token, profile, db };
}

export const requireAdmin = (req: NextRequest) => requireAuth(req, { roles: ['admin'] });
