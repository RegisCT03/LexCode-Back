import { AuthError } from '@supabase/supabase-js';
import { ZodError } from 'zod';

/** Error con código HTTP y código estable que el frontend puede usar. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, 'invalid_request', message, details);
export const unauthorized = (message = 'Inicia sesión para continuar', code = 'unauthorized') =>
  new AppError(401, code, message);
export const forbidden = (message = 'No tienes permiso para esta acción', code = 'forbidden') =>
  new AppError(403, code, message);
export const notFound = (message = 'No se encontró el recurso') => new AppError(404, 'not_found', message);
export const conflict = (message: string, code = 'conflict') => new AppError(409, code, message);

type PgError = { code?: string; message: string; details?: string | null; hint?: string | null };

/**
 * Traduce errores de PostgREST/PostgreSQL. Las funciones de la base lanzan
 * mensajes en español pensados para el usuario (P0001, P0002, 42501).
 */
export function fromDatabase(err: PgError): AppError {
  const code = err.code ?? '';
  switch (code) {
    case '42501':
      return forbidden(err.message.startsWith('permission denied') ? undefined : err.message);
    case 'P0001':
      return new AppError(422, 'business_rule', err.message);
    case 'P0002':
    case 'PGRST116':
      return notFound(code === 'PGRST116' ? undefined : err.message);
    case '23505':
      return conflict('Ese dato ya está registrado', 'already_exists');
    case '23503':
      return badRequest('Hace referencia a un registro que no existe');
    case '23514':
    case '23502':
    case '22023':
    case '22P02':
    case '22007':
    case '22008':
      return badRequest(code === '22023' ? err.message : 'Algún dato no tiene el formato correcto');
    case 'PGRST301':
    case 'PGRST303':
      return unauthorized('Tu sesión expiró, vuelve a iniciar sesión', 'session_expired');
    default:
      return new AppError(500, 'database_error', 'Error inesperado en la base de datos', {
        code,
        message: err.message,
      });
  }
}

const AUTH_MESSAGES: Record<string, [number, string]> = {
  invalid_credentials: [401, 'Correo o contraseña incorrectos'],
  email_not_confirmed: [403, 'Confirma tu correo antes de iniciar sesión'],
  user_already_exists: [409, 'Ya existe una cuenta con ese correo'],
  email_exists: [409, 'Ya existe una cuenta con ese correo'],
  weak_password: [400, 'La contraseña es muy débil'],
  same_password: [400, 'La nueva contraseña debe ser diferente a la actual'],
  over_request_rate_limit: [429, 'Demasiados intentos, espera un momento'],
  over_email_send_rate_limit: [429, 'Se enviaron demasiados correos, espera un momento'],
  refresh_token_not_found: [401, 'Tu sesión expiró, vuelve a iniciar sesión'],
  refresh_token_already_used: [401, 'Tu sesión expiró, vuelve a iniciar sesión'],
  session_not_found: [401, 'Tu sesión expiró, vuelve a iniciar sesión'],
  session_expired: [401, 'Tu sesión expiró, vuelve a iniciar sesión'],
  bad_jwt: [401, 'Tu sesión no es válida, vuelve a iniciar sesión'],
  user_banned: [403, 'Tu cuenta está suspendida'],
  otp_expired: [401, 'El enlace expiró, solicita uno nuevo'],
  signup_disabled: [403, 'El registro está deshabilitado'],
  user_not_found: [404, 'No existe esa cuenta'],
};

export function fromAuth(err: AuthError): AppError {
  const code = err.code ?? '';
  const known = AUTH_MESSAGES[code];
  if (known) return new AppError(known[0], code, known[1]);
  // El trigger de registro rechaza datos inválidos; Auth solo devuelve un mensaje genérico.
  if (/database error saving new user/i.test(err.message)) {
    return new AppError(422, 'registration_rejected', 'No se pudo crear la cuenta con esos datos');
  }
  if (err.status && err.status < 500) return new AppError(err.status, code || 'auth_error', err.message);
  return new AppError(502, 'auth_unavailable', 'El servicio de autenticación no respondió', { message: err.message });
}

export function fromZod(err: ZodError): AppError {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return badRequest('Revisa los datos enviados', { fields });
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return fromZod(err);
  if (err instanceof AuthError) return fromAuth(err);
  if (err && typeof err === 'object' && 'message' in err && 'code' in err) return fromDatabase(err as PgError);
  return new AppError(500, 'internal_error', 'Error interno del servidor');
}
