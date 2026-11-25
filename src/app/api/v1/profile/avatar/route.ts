import { requireAuth } from '@/lib/auth';
import { badRequest } from '@/lib/errors';
import { handler } from '@/lib/http';
import { removeAvatar, uploadAvatar } from '@/modules/profile/service';

/** POST /api/profile/avatar — multipart/form-data con el campo `avatar` (JPG, PNG o WebP, máx. 2 MB). */
export const POST = handler(async (req) => {
  const ctx = await requireAuth(req);
  const form = await req.formData().catch(() => null);
  const file = form?.get('avatar');
  if (!(file instanceof File)) throw badRequest('Envía la imagen en el campo "avatar"');
  return uploadAvatar(ctx, file);
});

/** DELETE /api/profile/avatar — quita la foto de perfil. */
export const DELETE = handler(async (req) => removeAvatar(await requireAuth(req)));
