import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Las pruebas llaman a la API real (npm run dev) conectada a un Supabase
 * LOCAL o de pruebas con los datos de supabase/seed.sql. Crean usuarios y
 * cambian roles: nunca las corras contra producción.
 */
export const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';

if (!/localhost|127\.0\.0\.1/.test(API) && process.env.ALLOW_REMOTE_TESTS !== '1') {
  throw new Error('Las pruebas solo corren contra localhost (define ALLOW_REMOTE_TESTS=1 para otro entorno de pruebas)');
}

export const DEMO_PASSWORD = 'LexCode2026!';
export const RUN = Date.now().toString(36).slice(-6);

export interface ApiResult {
  status: number;
  /** { data } o { error: { code, message, details? } } */
  body: any;
  headers: Headers;
}

export async function api(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; form?: FormData } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${API}${path}`, { method, headers, body });
  const text = await res.text();
  let parsed: any = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed, headers: res.headers };
}

export async function login(email: string, password = DEMO_PASSWORD): Promise<string> {
  const r = await api('POST', '/auth/login', { body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.data.session.accessToken as string;
}

/** Lee APP_SECRET de .env.local para firmar tokens del tutor como lo hace el backend. */
export function appSecret(): string {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  const line = readFileSync('.env.local', 'utf8').split('\n').find((l) => l.startsWith('APP_SECRET='));
  if (!line) throw new Error('Falta APP_SECRET en .env.local');
  return line.slice('APP_SECRET='.length).trim();
}

export function guardianToken(uid: string, guardianEmail: string, ttl = 3600): string {
  const body = Buffer.from(
    JSON.stringify({ uid, ge: guardianEmail, p: 'guardian', exp: Math.floor(Date.now() / 1000) + ttl }),
  ).toString('base64url');
  const sig = createHmac('sha256', appSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export const adult = (tag: string) => ({
  fullName: `Prueba ${tag}`,
  username: `t_${tag}_${RUN}`.slice(0, 30),
  email: `${tag}.${RUN}@prueba.test`,
  password: 'Clave1234',
  birthDate: '2001-05-05',
  acceptPrivacy: true,
  acceptTerms: true,
});
