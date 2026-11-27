import { z } from 'zod';

export const memoryPairsSchema = z.object({
  pairs: z
    .array(
      z.object({
        concept: z.string().trim().min(2).max(150),
        definition: z.string().trim().min(5).max(300),
      }),
    )
    .min(2, 'El memorama necesita al menos 2 parejas')
    .max(12),
});

export const fillBlankSchema = z.object({
  items: z
    .array(
      z
        .object({
          ruleTitle: z.string().trim().min(3).max(150),
          
          prefix: z.string().trim().min(1),
          
          suffix: z.string().trim().default(''),
          answer: z.string().trim().min(1).max(80),
          options: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
        })
        .refine((i) => i.options.includes(i.answer), { path: ['options'], message: 'La respuesta debe estar entre las opciones' })
        .refine((i) => new Set(i.options).size === i.options.length, { path: ['options'], message: 'Las opciones no pueden repetirse' }),
    )
    .min(1, 'Agrega al menos una frase')
    .max(20),
});
