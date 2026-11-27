import { z } from 'zod';
import { uuid } from '@/lib/validation';


export const progressQuery = z.object({ studentId: uuid.optional() });
