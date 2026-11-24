import { z } from 'zod';

const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  FRONTEND_URL: z.url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  APP_SECRET: z.string().min(32, 'APP_SECRET debe tener al menos 32 caracteres'),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('LexCode <no-reply@lexcode.app>'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Variables de entorno validadas. Se leen al primer uso para no romper el build. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuración inválida en .env.local → ${missing}`);
  }
  cached = parsed.data;
  return cached;
}
