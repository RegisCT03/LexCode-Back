import type { z } from 'zod';
import type { AuthContext } from '@/lib/auth';
import { camelize } from '@/lib/format';
import { forbidden } from '@/lib/errors';
import { serviceClient, unwrap } from '@/lib/supabase';
import type { teacherDashboardQuery } from './schemas';

const DAY = 86_400_000;
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);


export async function studentDashboard({ db }: AuthContext) {
  return camelize(unwrap(await db.rpc('get_my_dashboard')));
}





export async function teacherDashboard(ctx: AuthContext, q: z.infer<typeof teacherDashboardQuery>) {
  const { db, userId } = ctx;
  const groups = unwrap(
    await db.from('groups').select('id, name, subject, is_active').eq('teacher_id', userId).order('name'),
  ) as { id: string }[];

  let studentsQuery = db
    .from('v_teacher_group_progress')
    .select('group_id, group_name, student_id, full_name, student_number, xp_total, level, status, average_score, modules_completed, current_module, last_activity_at');
  if (q.groupId) studentsQuery = studentsQuery.eq('group_id', q.groupId);
  const students = unwrap(await studentsQuery.order('full_name')) as { student_id: string; average_score: number | null }[];
  const ids = [...new Set(students.map((s) => s.student_id))];

  
  const since = new Date(Date.now() - 14 * DAY).toISOString();
  const attempts = ids.length
    ? (unwrap(
        await db.from('attempts').select('student_id, score, finished_at').in('student_id', ids).not('finished_at', 'is', null).gte('finished_at', since),
      ) as { score: number; finished_at: string }[])
    : [];
  const cut = Date.now() - 7 * DAY;
  const current = avg(attempts.filter((a) => new Date(a.finished_at).getTime() >= cut).map((a) => Number(a.score)));
  const previous = avg(attempts.filter((a) => new Date(a.finished_at).getTime() < cut).map((a) => Number(a.score)));

  
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const justified = ids.length
    ? await db
        .from('answers')
        .select('id, attempt:attempts!inner(student_id, activity, finished_at)', { count: 'exact', head: true })
        .not('justification', 'is', null)
        .eq('attempt.activity', 'dilemma')
        .in('attempt.student_id', ids)
        .gte('answered_at', weekAgo)
    : { count: 0, error: null };
  if (justified.error) throw justified.error;

  const published = await db.from('modules').select('id', { count: 'exact', head: true }).eq('is_published', true);
  if (published.error) throw published.error;

  let recentQuery = db
    .from('v_teacher_recent_submissions')
    .select('attempt_id, group_id, full_name, activity, activity_title, score, finished_at');
  if (q.groupId) recentQuery = recentQuery.eq('group_id', q.groupId);
  const recent = unwrap(await recentQuery.order('finished_at', { ascending: false }).limit(q.recent));

  
  const chart = await pathStats(ctx);

  return camelize({
    groups,
    studentCount: ids.length,
    publishedModules: published.count ?? 0,
    groupAverage: { current, previous, delta: current !== null && previous !== null ? Math.round((current - previous) * 10) / 10 : null },
    pendingReview: justified.count ?? 0,
    students,
    progressChart: chart,
    recentSubmissions: recent,
  });
}





export async function questionStats({ db, profile }: AuthContext, quizId: string) {
  const quiz = unwrap(await db.from('quizzes').select('id, group_id').eq('id', quizId).maybeSingle()) as { group_id: string | null };
  if (profile.role !== 'admin') {
    const ok = quiz.group_id ? unwrap(await db.rpc('is_group_teacher', { p_group_id: quiz.group_id })) : false;
    if (!ok) throw forbidden('Solo el docente del grupo puede ver estas estadísticas');
  }
  const questions = unwrap(await db.from('quiz_questions').select('id, prompt, sort_order').eq('quiz_id', quizId).order('sort_order')) as {
    id: string;
    prompt: string;
  }[];
  const rows = questions.length
    ? (unwrap(
        await serviceClient().from('answers').select('question_id, is_correct, time_ms').in('question_id', questions.map((q) => q.id)),
      ) as { question_id: string; is_correct: boolean; time_ms: number }[])
    : [];

  return questions.map((q) => {
    const mine = rows.filter((r) => r.question_id === q.id);
    const correct = mine.filter((r) => r.is_correct).length;
    return {
      questionId: q.id,
      prompt: q.prompt,
      answers: mine.length,
      correctPct: mine.length ? Math.round((1000 * correct) / mine.length) / 10 : null,
      avgSeconds: avg(mine.map((r) => r.time_ms / 1000)),
    };
  });
}





export async function pathStats({ db, profile }: AuthContext) {
  const [paths, modules] = await Promise.all([
    db.from('learning_paths').select('id, title, sort_order').eq('is_published', true).order('sort_order'),
    db.from('modules').select('id, path_id, title, sort_order').not('path_id', 'is', null).eq('is_published', true).order('sort_order'),
  ]);
  if (paths.error) throw paths.error;
  if (modules.error) throw modules.error;

  let scope: string[] | null = null; 
  if (profile.role !== 'admin') {
    const mine = unwrap(await db.from('v_teacher_group_progress').select('student_id')) as { student_id: string }[];
    scope = [...new Set(mine.map((m) => m.student_id))];
  }
  let progress: { module_id: string; status: string }[] = [];
  if (scope === null || scope.length) {
    let q = serviceClient().from('module_progress').select('module_id, status');
    if (scope) q = q.in('student_id', scope);
    progress = unwrap(await q) as { module_id: string; status: string }[];
  }

  return (modules.data as { id: string; path_id: string; title: string; sort_order: number }[]).flatMap((m) => {
    const path = (paths.data as { id: string; title: string }[]).find((p) => p.id === m.path_id);
    if (!path) return [];
    const mine = progress.filter((p) => p.module_id === m.id);
    return [
      {
        pathId: path.id,
        pathTitle: path.title,
        moduleId: m.id,
        moduleTitle: m.title,
        sortOrder: m.sort_order,
        started: mine.length,
        completed: mine.filter((p) => p.status === 'completed').length,
      },
    ];
  });
}





export async function reminders({ db, userId }: AuthContext) {
  const consents = unwrap(await db.rpc('my_consents')) as { type: string; granted: boolean }[];
  if (!consents.some((c) => c.type === 'secondary_purposes' && c.granted)) return { enabled: false, reminders: [] };

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date()); 
  const p = unwrap(await db.from('profiles').select('current_streak, last_activity_date').eq('id', userId).single()) as {
    current_streak: number;
    last_activity_date: string | null;
  };
  const items: Record<string, unknown>[] = [];
  if (p.current_streak > 0 && p.last_activity_date && p.last_activity_date < today) {
    items.push({ type: 'streakAtRisk', currentStreak: p.current_streak });
  }

  const weekStart = new Date(Date.now() - 6 * DAY).toISOString().slice(0, 10);
  const weekly = unwrap(
    await db
      .from('dilemmas')
      .select('id, title')
      .eq('is_weekly', true)
      .eq('is_published', true)
      .gte('week_start', weekStart)
      .lte('week_start', today)
      .limit(1),
  ) as { id: string; title: string }[];
  if (weekly[0]) {
    const done = await db
      .from('attempts')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', userId)
      .eq('dilemma_id', weekly[0].id)
      .not('finished_at', 'is', null);
    if (done.error) throw done.error;
    if (!done.count) items.push({ type: 'weeklyDilemma', dilemmaId: weekly[0].id, title: weekly[0].title });
  }
  return { enabled: true, reminders: items };
}
