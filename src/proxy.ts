import { NextResponse, type NextRequest } from 'next/server';

/**
 * CORS para el frontend (otro dominio). Los orígenes permitidos vienen de
 * CORS_ORIGINS, separados por coma.
 */
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
};

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin') ?? '';
  const isAllowed = allowedOrigins.includes(origin);

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: { ...(isAllowed && { 'Access-Control-Allow-Origin': origin }), ...corsHeaders },
    });
  }

  const response = NextResponse.next();
  if (isAllowed) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    // Para que el frontend lea el nombre del archivo en descargas (exportar mis datos).
    response.headers.set('Access-Control-Expose-Headers', 'Content-Disposition');
  }
  Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
