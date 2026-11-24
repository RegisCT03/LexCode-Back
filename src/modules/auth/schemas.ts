import { z } from 'zod';

export const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;

export const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña es demasiado larga')
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
  .regex(/[0-9]/, 'La contraseña debe incluir al menos un número');

export const email = z.string().trim().toLowerCase().pipe(z.email('Correo electrónico inválido'));

export const username = z
  .string()
  .trim()
  .regex(USERNAME_RE, 'Usa de 3 a 30 letras, números o guion bajo, sin espacios');

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Escribe tu nombre completo').max(120),
    username,
    email,
    password,
    birthDate: z.iso.date('Usa el formato AAAA-MM-DD'),
    guardianEmail: email.optional(),
    acceptPrivacy: z.literal(true, 'Debes aceptar el Aviso de Privacidad'),
    acceptTerms: z.literal(true, 'Debes aceptar los Términos y Condiciones'),
    secondaryPurposes: z.boolean().default(false),
  })
  .refine((d) => !d.guardianEmail || d.guardianEmail !== d.email, {
    path: ['guardianEmail'],
    message: 'El correo del tutor debe ser distinto al tuyo',
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({ email, password: z.string().min(1, 'Escribe tu contraseña') });
export const refreshSchema = z.object({ refreshToken: z.string().min(10) });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ password });
export const guardianConfirmSchema = z.object({ token: z.string().min(20) });
export const usernameQuery = z.object({ username });

/** Edad cumplida a la fecha de hoy (zona horaria de México). */
export function ageOn(birthDate: string, today = new Date()): number {
  const now = new Date(today.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const [y, m, d] = birthDate.split('-').map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}
