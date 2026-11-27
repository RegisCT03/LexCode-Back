import { z } from 'zod';
import { pagination } from '@/lib/validation';


export const folio = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^LX-[A-Z0-9]{9}$/, 'El folio tiene el formato LX-XXXXXXXXX');

export const revokeSchema = z.object({ revoked: z.boolean() });
export const adminListQuery = pagination.extend({ revoked: z.enum(['true', 'false']).optional() });
