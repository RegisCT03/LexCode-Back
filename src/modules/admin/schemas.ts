import { z } from 'zod';
import { pagination, uuid } from '@/lib/validation';

const slug = z.string().trim().regex(/^[a-z0-9-]{2,80}$/, 'Usa minúsculas, números y guiones');

export const usersQuery = pagination.extend({
  role: z.enum(['student', 'teacher', 'admin']).optional(),
  status: z.enum(['pending_guardian', 'active', 'suspended', 'deleted']).optional(),
  q: z.string().trim().max(100).optional(),
});

export const roleSchema = z.object({ role: z.enum(['student', 'teacher', 'admin']) });
export const statusSchema = z.object({ status: z.enum(['active', 'suspended']) });

export const reportsQuery = pagination.extend({
  status: z.enum(['open', 'reviewing', 'resolved', 'dismissed']).optional(),
});
export const reportUpdateSchema = z.object({ status: z.enum(['open', 'reviewing', 'resolved', 'dismissed']) });

export const arcoQuery = pagination.extend({
  status: z.enum(['received', 'info_required', 'in_review', 'approved', 'rejected', 'resolved']).optional(),
});
export const arcoUpdateSchema = z
  .object({
    status: z.enum(['received', 'info_required', 'in_review', 'approved', 'rejected', 'resolved']),
    response: z.string().trim().min(5).max(4000).optional(),
  })
  .refine((d) => !['approved', 'rejected', 'resolved', 'info_required'].includes(d.status) || !!d.response, {
    path: ['response'],
    message: 'Escribe la respuesta que recibirá la persona',
  });

export const glossaryCreateSchema = z.object({
  slug: slug.optional(),
  term: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60),
  definition: z.string().trim().min(10),
  legalCitation: z.string().trim().min(3),
  legalReferenceId: uuid.nullable().optional(),
  lexisTip: z.string().trim().max(500).nullable().optional(),
});
export const glossaryUpdateSchema = glossaryCreateSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Envía al menos un campo');

export const LEXIS_EXPRESSIONS = ['happy', 'neutral', 'sad', 'angry', 'book_bulb', 'wave'] as const;

export const topicCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  keywords: z.array(z.string().trim().min(2).max(60)).min(1, 'Agrega al menos una palabra clave').max(30),
  suggestedQuestion: z.string().trim().max(200).nullable().optional(),
  moduleId: uuid.nullable().optional(),
  answer: z
    .object({
      body: z.string().trim().min(10).max(2000),
      expression: z.enum(LEXIS_EXPRESSIONS).default('neutral'),
      legalReferenceId: uuid.nullable().optional(),
      glossaryTermId: uuid.nullable().optional(),
    })
    .optional(),
});
export const topicUpdateSchema = topicCreateSchema
  .omit({ answer: true })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Envía al menos un campo');
export const answerSchema = z.object({
  body: z.string().trim().min(10).max(2000),
  expression: z.enum(LEXIS_EXPRESSIONS).default('neutral'),
  legalReferenceId: uuid.nullable().optional(),
  glossaryTermId: uuid.nullable().optional(),
});

export const legalDocumentSchema = z.object({
  type: z.enum(['privacy_notice', 'terms']),
  version: z.string().trim().regex(/^\d{1,3}\.\d{1,3}$/, 'Usa el formato 5.1'),
  title: z.string().trim().min(3).max(150),
  contentUrl: z.url(),
  effectiveAt: z.iso.date(),
});

export const auditQuery = pagination.extend({
  table: z.string().trim().max(60).optional(),
  action: z.enum(['INSERT', 'UPDATE', 'DELETE', 'ADMIN_READ', 'EXPORT']).optional(),
  actorId: uuid.optional(),
  recordId: z.string().trim().max(100).optional(),
});

export const unansweredQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });
