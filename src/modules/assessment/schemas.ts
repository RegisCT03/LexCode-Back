import { z } from 'zod';
import { pagination, uuid } from '@/lib/validation';

export const ACTIVITIES = ['quiz', 'dilemma', 'memory_match', 'fill_blank'] as const;
export type Activity = (typeof ACTIVITIES)[number];

const timeMs = z.number().int().min(0).max(3_600_000).default(0);

export const startSchema = z.object({
  activity: z.enum(ACTIVITIES),
  
  targetId: uuid,
});


export const answerSchemas = {
  quiz: z.object({
    questionId: uuid,
    
    optionId: uuid.nullable(),
    timeMs,
  }),
  dilemma: z.object({
    optionId: uuid,
    justification: z.string().trim().max(2000).nullable().optional(),
    timeMs,
  }),
  fill_blank: z.object({
    itemId: uuid,
    text: z.string().trim().min(1, 'Elige una palabra').max(80),
    timeMs,
  }),
  memory_match: z.object({
    
    matches: z.array(z.object({ concept: uuid, definition: uuid })).min(1).max(50),
    timeMs,
  }),
} satisfies Record<Activity, z.ZodType>;

export const historyQuery = pagination.extend({ activity: z.enum(ACTIVITIES).optional() });

export const cheatsQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });
