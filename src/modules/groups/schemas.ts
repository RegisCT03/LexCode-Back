import { z } from 'zod';
import { pagination, uuid } from '@/lib/validation';

export const groupCreateSchema = z.object({
  name: z.string().trim().min(3, 'Escribe el nombre del grupo').max(80),
  subject: z.string().trim().max(100).nullable().optional(),
  term: z.string().trim().max(20).nullable().optional(),
});


export const groupUpdateSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    subject: z.string().trim().max(100).nullable(),
    term: z.string().trim().max(20).nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Envía al menos un campo');

export const joinSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8}$/, 'El código tiene 8 letras o números'),
});

export const commentSchema = z.object({
  studentId: uuid,
  body: z.string().trim().min(1, 'Escribe el comentario').max(2000),
});

export const commentsQuery = pagination.extend({ groupId: uuid.optional(), studentId: uuid.optional() });
