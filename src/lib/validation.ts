import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, fromZod } from './errors';

export async function parseBody<T extends z.ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest('El cuerpo de la petición debe ser JSON válido');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw fromZod(parsed.error);
  return parsed.data;
}

export function parseQuery<T extends z.ZodType>(req: NextRequest, schema: T): z.infer<T> {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw fromZod(parsed.error);
  return parsed.data;
}

export function parseParam<T extends z.ZodType>(value: unknown, schema: T): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw badRequest('Identificador inválido');
  return parsed.data;
}

// Piezas reutilizables
export const uuid = z.uuid('Identificador inválido');
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof pagination>;

export function pageRange({ page, pageSize }: Pagination): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}
