import type { NextRequest } from 'next/server';
import { toAppError } from './errors';

/**
 * Formato único de respuesta:
 *   éxito → { data }             error → { error: { code, message, details? } }
 */
export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json({ data }, { status, headers });
}

export function created(data: unknown): Response {
  return json(data, 201);
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function errorResponse(err: unknown): Response {
  const e = toAppError(err);
  if (e.status >= 500) {
    console.error(`[api] ${e.code}: ${e.message}`, e.details ?? '', err instanceof Error && err !== e ? err : '');
  }
  const body: { code: string; message: string; details?: unknown } = { code: e.code, message: e.message };
  // Los detalles de errores 5xx (mensajes internos de la base) no se envían al cliente.
  if (e.details !== undefined && e.status < 500) body.details = e.details;
  return Response.json({ error: body }, { status: e.status });
}

type Ctx<P> = { params: Promise<P> };

/**
 * Envuelve un route handler: lo que devuelva se manda como { data },
 * y cualquier error se convierte al formato estándar.
 */
export function handler<P = Record<string, never>>(
  fn: (req: NextRequest, ctx: Ctx<P>) => Promise<unknown>,
) {
  return async (req: NextRequest, ctx: Ctx<P>): Promise<Response> => {
    try {
      const result = await fn(req, ctx);
      if (result instanceof Response) return result;
      return json(result ?? null);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** IP del cliente (Vercel la pone en x-forwarded-for). */
export function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}
