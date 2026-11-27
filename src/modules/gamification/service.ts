import type { z } from 'zod';
import type { AuthContext } from '@/lib/auth';
import { camelize } from '@/lib/format';
import { unwrap } from '@/lib/supabase';
import { pageRange, type Pagination } from '@/lib/validation';
import type { summaryQuery } from './schemas';







type Criteria = { type: string; days?: number; amount?: number; count?: number; area?: string };

const AREA_NAMES: Record<string, string> = {
  ethics: 'ética',
  legislation: 'legislación',
  cybersecurity: 'ciberseguridad',
  intellectual_property: 'propiedad intelectual',
  data_protection: 'protección de datos',
};


export function requirementText(c: Criteria): string {
  switch (c.type) {
    case 'first_quiz':
      return 'Termina tu primer quiz';
    case 'quizzes_completed':
      return `Termina ${c.count} quizzes`;
    case 'quiz_won':
      return 'Aprueba un quiz con 70 o más';
    case 'perfect_quiz':
      return 'Saca 100 en un quiz';
    case 'streak':
      return `Mantén una racha de ${c.days} días`;
    case 'xp':
      return `Reúne ${c.amount} XP`;
    case 'dilemmas':
      return `Resuelve bien ${c.count} dilemas`;
    case 'path_completed':
      return c.area ? `Completa una ruta de ${AREA_NAMES[c.area] ?? c.area}` : 'Completa una ruta';
    default:
      return 'Sigue practicando';
  }
}


export async function badges({ db, userId }: AuthContext) {
  const [all, mine] = await Promise.all([
    db.from('badges').select('id, code, title, description, variant, criteria, sort_order').order('sort_order'),
    db.from('user_badges').select('badge_id, earned_at').eq('student_id', userId),
  ]);
  if (all.error) throw all.error;
  if (mine.error) throw mine.error;
  const earnedAt = new Map(mine.data.map((b) => [b.badge_id as number, b.earned_at as string]));
  const items = all.data.map((b) => ({
    code: b.code,
    title: b.title,
    description: b.description,
    variant: b.variant,
    requirement: requirementText(b.criteria as Criteria),
    earned: earnedAt.has(b.id),
    earnedAt: earnedAt.get(b.id) ?? null,
  }));
  return { items, earned: items.filter((i) => i.earned).length, total: items.length };
}


export async function summary({ db, userId }: AuthContext, q: z.infer<typeof summaryQuery>) {
  const p = unwrap(
    await db
      .from('profiles')
      .select('xp_total, level, current_streak, longest_streak, last_activity_date')
      .eq('id', userId)
      .single(),
  ) as { xp_total: number; level: number; current_streak: number; longest_streak: number; last_activity_date: string | null };
  const levels = unwrap(await db.from('levels').select('level, min_xp, title').in('level', [p.level, p.level + 1])) as {
    level: number;
    min_xp: number;
    title: string;
  }[];
  const current = levels.find((l) => l.level === p.level);
  const next = levels.find((l) => l.level === p.level + 1);

  const since = new Date(Date.now() - q.days * 86_400_000).toISOString().slice(0, 10);
  const days = unwrap(
    await db.from('daily_activity').select('activity_date, activities').eq('student_id', userId).gte('activity_date', since).order('activity_date'),
  );

  return {
    xp: {
      total: p.xp_total,
      level: p.level,
      levelTitle: current?.title ?? null,
      levelMinXp: current?.min_xp ?? 0,
      nextLevelXp: next?.min_xp ?? null,
      xpToNext: next ? Math.max(next.min_xp - p.xp_total, 0) : 0,
    },
    streak: { current: p.current_streak, longest: p.longest_streak, lastActivityDate: p.last_activity_date },
    activity: camelize(days),
  };
}


export async function xpHistory({ db, userId }: AuthContext, page: Pagination) {
  const { from, to } = pageRange(page);
  const { data, error, count } = await db
    .from('xp_transactions')
    .select('id, amount, reason, source_id, created_at', { count: 'exact' })
    .eq('student_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { items: camelize(data), total: count ?? 0, page: page.page, pageSize: page.pageSize };
}


export async function groupRanking({ db }: AuthContext, groupId: string) {
  return camelize(unwrap(await db.rpc('get_group_ranking', { p_group: groupId })));
}


export async function publicRanking({ db }: AuthContext, limit: number) {
  return camelize(unwrap(await db.rpc('get_public_ranking', { p_limit: limit })));
}
