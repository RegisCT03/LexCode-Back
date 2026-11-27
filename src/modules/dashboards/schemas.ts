import { z } from 'zod';
import { uuid } from '@/lib/validation';

export const teacherDashboardQuery = z.object({
  
  groupId: uuid.optional(),
  recent: z.coerce.number().int().min(1).max(50).default(10),
});
export const questionStatsQuery = z.object({ quizId: uuid });
