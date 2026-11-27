import { z } from 'zod';
import { pagination } from '@/lib/validation';

export const xpHistoryQuery = pagination;
export const publicRankingQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });
export const summaryQuery = z.object({ days: z.coerce.number().int().min(7).max(120).default(30) });
