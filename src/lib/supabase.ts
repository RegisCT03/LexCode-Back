import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';
import { notFound } from './errors';

const stateless = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

/**
 * Cliente sin sesión para operaciones de Auth (registro, login, refresh).
 * Se crea uno por petición para no compartir sesiones entre usuarios.
 */
export function anonClient(): SupabaseClient {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env();
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: stateless });
}

/**
 * Cliente que actúa COMO el usuario: aplica RLS y auth.uid() en la base.
 * Es el cliente por defecto para todo lo que hace un estudiante o docente.
 */
export function userClient(accessToken: string): SupabaseClient {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env();
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: stateless,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

let service: SupabaseClient | null = null;

/**
 * Cliente con la llave service_role: OMITE RLS. Úsalo solo después de
 * verificar permisos en el backend (admin, tareas internas, Auth admin).
 */
export function serviceClient(): SupabaseClient {
  if (service) return service;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: stateless });
  return service;
}

/** Lanza el error de PostgREST si existe (o 404 si no hay datos) y devuelve los datos. */
export function unwrap<T>(res: { data: T | null; error: { code?: string; message: string } | null }): T {
  if (res.error) throw res.error;
  if (res.data === null) throw notFound();
  return res.data;
}
