import { z } from 'zod';
import { pagination, uuid } from '@/lib/validation';

const slug = z.string().trim().regex(/^[a-z0-9-]{2,60}$/, 'Usa minúsculas, números y guiones');
const AREAS = ['ethics', 'legislation', 'cybersecurity', 'intellectual_property', 'data_protection'] as const;
const LABELS = ['A', 'B', 'C', 'D'] as const;
const nonEmpty = <T extends z.ZodRawShape>(s: z.ZodObject<T>) =>
  s.partial().refine((d) => Object.keys(d).length > 0, 'Envía al menos un campo');


export const pathCreateSchema = z.object({
  slug,
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  area: z.enum(AREAS),
  sortOrder: z.number().int().min(1).max(1000),
  isPublished: z.boolean().default(false),
});
export const pathUpdateSchema = nonEmpty(pathCreateSchema.omit({ isPublished: true }).extend({ isPublished: z.boolean() }));


export const moduleCreateSchema = z.object({
  pathId: uuid,
  title: z.string().trim().min(3).max(120),
  standard: z.string().trim().max(150).nullable().optional(),
  
  content: z.record(z.string(), z.unknown()).default({}),
  interactionType: z.enum(['multiple_choice', 'fill_blank', 'memory_match']).default('multiple_choice'),
  sortOrder: z.number().int().min(1).max(1000),
  xpReward: z.number().int().min(0).max(1000).default(50),
  prerequisiteId: uuid.nullable().optional(),
  isPublished: z.boolean().default(false),
});
export const moduleUpdateSchema = nonEmpty(
  moduleCreateSchema.omit({ pathId: true }).extend({
    content: z.record(z.string(), z.unknown()),
    interactionType: z.enum(['multiple_choice', 'fill_blank', 'memory_match']),
    xpReward: z.number().int().min(0).max(1000),
    isPublished: z.boolean(),
  }),
);
export const moduleOrderSchema = z.object({
  moduleIds: z.array(uuid).min(1).max(200).refine((a) => new Set(a).size === a.length, 'Hay módulos repetidos'),
});


const dilemmaOption = z
  .object({
    label: z.enum(LABELS),
    body: z.string().trim().min(3).max(1000),
    isExpected: z.boolean(),
    xpDelta: z.number().int().min(-1000).max(1000),
    feedbackTitle: z.string().trim().min(3).max(120),
    feedbackText: z.string().trim().min(10).max(2000),
    sanction: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((o) => (o.isExpected ? o.xpDelta > 0 : o.xpDelta <= 0), {
    path: ['xpDelta'],
    message: 'La opción esperada suma XP; las demás restan o dejan en cero',
  });

const dilemmaOptions = z
  .array(dilemmaOption)
  .min(2, 'Un dilema necesita al menos 2 opciones')
  .max(4)
  .refine((o) => o.filter((x) => x.isExpected).length === 1, 'Debe haber exactamente una opción esperada')
  .refine((o) => new Set(o.map((x) => x.label)).size === o.length, 'Las letras de las opciones no pueden repetirse');

export const dilemmaCreateSchema = z.object({
  moduleId: uuid.nullable().optional(),
  number: z.number().int().min(1).max(500),
  title: z.string().trim().min(3).max(150),
  category: z.string().trim().min(2).max(80),
  subtitle: z.string().trim().max(200).nullable().optional(),
  scenario: z.string().trim().min(20),
  lawQuote: z.string().trim().min(5),
  legalReferenceId: uuid.nullable().optional(),
  isPublished: z.boolean().default(true),
  options: dilemmaOptions,
});
export const dilemmaUpdateSchema = nonEmpty(dilemmaCreateSchema.extend({ isPublished: z.boolean() }));
export const weeklyDilemmaSchema = z.object({ dilemmaId: uuid, weekStart: z.iso.date('Usa el formato AAAA-MM-DD') });


const quizQuestion = z
  .object({
    prompt: z.string().trim().min(5).max(1000),
    type: z.enum(['multiple_choice', 'true_false']).default('multiple_choice'),
    explanation: z.string().trim().min(5).max(2000),
    legalReferenceId: uuid.nullable().optional(),
    xpCorrect: z.number().int().min(1).max(500).default(150),
    xpWrong: z.number().int().min(-500).max(0).default(-50),
    options: z
      .array(
        z.object({
          label: z.enum(LABELS),
          body: z.string().trim().min(1).max(300),
          isCorrect: z.boolean(),
        }),
      )
      .min(2)
      .max(4)
      .refine((o) => o.filter((x) => x.isCorrect).length === 1, 'Cada pregunta necesita exactamente una opción correcta')
      .refine((o) => new Set(o.map((x) => x.label)).size === o.length, 'Las letras de las opciones no pueden repetirse'),
  })
  .refine((q) => q.type !== 'true_false' || q.options.length === 2, {
    path: ['options'],
    message: 'Verdadero/falso lleva exactamente 2 opciones',
  });

const quizQuestions = z.array(quizQuestion).min(1, 'Agrega al menos una pregunta').max(50);

const quizBase = z.object({
    
    moduleId: uuid.optional(),
    
    groupId: uuid.optional(),
    slug: slug.optional(),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(300).nullable().optional(),
    area: z.enum(AREAS).nullable().optional(),
    timeLimitSeconds: z.number().int().min(5).max(3600).nullable().optional(),
    maxAttempts: z.number().int().min(1).max(10).default(3),
    dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
    isPublished: z.boolean().default(false),
    questions: quizQuestions,
});

export const quizCreateSchema = quizBase.refine((d) => !!d.moduleId !== !!d.groupId, {
  path: ['groupId'],
  message: 'Indica moduleId (quiz oficial) o groupId (quiz de grupo), no ambos',
});
export const quizUpdateSchema = nonEmpty(
  quizBase.omit({ moduleId: true, groupId: true }).extend({ maxAttempts: z.number().int().min(1).max(10), isPublished: z.boolean() }),
);

export const quizListQuery = pagination.extend({ moduleId: uuid.optional(), groupId: uuid.optional() });
