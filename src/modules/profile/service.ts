import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { AuthContext } from '@/lib/auth';
import { AppError, badRequest, conflict } from '@/lib/errors';
import { unwrap } from '@/lib/supabase';
import { username } from '@/modules/auth/schemas';
import { isUsernameAvailable } from '@/modules/auth/service';

export const SUBJECT_AREAS = ['ethics', 'legislation', 'cybersecurity', 'intellectual_property', 'data_protection'] as const;

const PROFILE_COLUMNS =
  'id, full_name, username, email, role, status, institution_id, student_number, major, semester, interest_area, ' +
  'avatar_url, xp_total, level, current_streak, longest_streak, last_activity_date, public_ranking, untimed_mode, ' +
  'deleted_at, created_at, updated_at, institution:institutions(id, name, short_name)';

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(3).max(120),
    username,
    major: z.string().trim().max(100).nullable(),
    semester: z.number().int().min(1).max(12).nullable(),
    studentNumber: z.string().trim().max(20).nullable(),
    interestArea: z.enum(SUBJECT_AREAS).nullable(),
    untimedMode: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Envía al menos un campo');
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Escribe tu contraseña actual'),
  newPassword: z.string().min(8).max(72).regex(/[A-Za-z]/).regex(/[0-9]/),
});

const AVATAR_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const SIGNED_URL_TTL = 60 * 60; // 1 hora

/** El bucket de avatares es privado: se guarda la ruta y se entrega una URL firmada. */
async function withAvatarUrl<T extends { avatar_url: string | null }>(db: SupabaseClient, profile: T) {
  if (!profile.avatar_url || profile.avatar_url.startsWith('http')) return profile;
  const { data } = await db.storage.from('avatars').createSignedUrl(profile.avatar_url, SIGNED_URL_TTL);
  return { ...profile, avatar_url: data?.signedUrl ?? null };
}

export async function getProfile({ db, userId }: AuthContext) {
  const profile = unwrap(await db.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single());
  return withAvatarUrl(db, profile as unknown as { avatar_url: string | null });
}

export async function updateProfile(ctx: AuthContext, input: UpdateProfileInput) {
  if (input.username && input.username.toLowerCase() !== ctx.profile.username.toLowerCase()) {
    if (!(await isUsernameAvailable(input.username))) throw conflict('Ese nombre de usuario ya está en uso', 'username_taken');
  }
  const patch: Record<string, unknown> = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.username !== undefined) patch.username = input.username;
  if (input.major !== undefined) patch.major = input.major;
  if (input.semester !== undefined) patch.semester = input.semester;
  if (input.studentNumber !== undefined) patch.student_number = input.studentNumber;
  if (input.interestArea !== undefined) patch.interest_area = input.interestArea;
  if (input.untimedMode !== undefined) patch.untimed_mode = input.untimedMode;

  const { error } = await ctx.db.from('profiles').update(patch).eq('id', ctx.userId);
  if (error) {
    if (error.code === '23505') throw conflict('Esa matrícula ya está registrada en tu institución', 'student_number_taken');
    throw error;
  }
  return getProfile(ctx);
}

export async function uploadAvatar(ctx: AuthContext, file: File) {
  const ext = AVATAR_TYPES[file.type];
  if (!ext) throw badRequest('La imagen debe ser JPG, PNG o WebP');
  if (file.size > AVATAR_MAX_BYTES) throw badRequest('La imagen debe pesar máximo 2 MB');

  const path = `${ctx.userId}/avatar-${Date.now()}.${ext}`;
  const { error: uploadError } = await ctx.db.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new AppError(502, 'storage_error', 'No se pudo subir la imagen', { message: uploadError.message });

  const previous = ctx.profile.avatar_url;
  const { error } = await ctx.db.from('profiles').update({ avatar_url: path }).eq('id', ctx.userId);
  if (error) throw error;
  if (previous && !previous.startsWith('http')) await ctx.db.storage.from('avatars').remove([previous]);
  return getProfile(ctx);
}

export async function removeAvatar(ctx: AuthContext) {
  const previous = ctx.profile.avatar_url;
  const { error } = await ctx.db.from('profiles').update({ avatar_url: null }).eq('id', ctx.userId);
  if (error) throw error;
  if (previous && !previous.startsWith('http')) await ctx.db.storage.from('avatars').remove([previous]);
  return getProfile(ctx);
}
