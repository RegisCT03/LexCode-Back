import type { z } from 'zod';
import type { AuthContext } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { camelize } from '@/lib/format';
import { serviceClient, unwrap } from '@/lib/supabase';
import { pageRange } from '@/lib/validation';
import { type Activity, answerSchemas, type historyQuery, type startSchema } from './schemas';

type Attempt = {
  id: string;
  activity: Activity;
  quiz_id: string | null;
  dilemma_id: string | null;
  module_id: string | null;
  attempt_number: number;
  score: number | null;
  xp_earned: number;
  started_at: string;
  finished_at: string | null;
};

const ATTEMPT_COLUMNS = 'id, activity, quiz_id, dilemma_id, module_id, attempt_number, score, xp_earned, started_at, finished_at';






const FEEDBACK_ALLOWANCE_MS = 30_000;

async function loadAttempt({ db }: AuthContext, id: string): Promise<Attempt> {
  const a = unwrap(await db.from('attempts').select(ATTEMPT_COLUMNS).eq('id', id).maybeSingle());
  return a as unknown as Attempt;
}


async function attemptState(ctx: AuthContext, a: Attempt) {
  const { db } = ctx;
  const answers = unwrap(
    await db
      .from('answers')
      .select('question_id, quiz_option_id, dilemma_option_id, memory_pair_id, fill_blank_item_id, is_correct, xp_delta, answered_at')
      .eq('attempt_id', a.id)
      .order('answered_at'),
  );

  const count = async (table: string, col: string, value: string | null) => {
    const { count: n, error } = await db.from(table).select('id', { count: 'exact', head: true }).eq(col, value ?? '');
    if (error) throw error;
    return n ?? 0;
  };
  const total =
    a.activity === 'quiz'
      ? await count('quiz_questions', 'quiz_id', a.quiz_id)
      : a.activity === 'dilemma'
        ? 1
        : a.activity === 'memory_match'
          ? await count('memory_pairs', 'module_id', a.module_id)
          : await count('fill_blank_items', 'module_id', a.module_id);

  let timer: { perQuestionSeconds: number | null; untimed: boolean } = { perQuestionSeconds: null, untimed: false };
  if (a.activity === 'quiz') {
    const quiz = unwrap(await db.from('quizzes').select('time_limit_seconds').eq('id', a.quiz_id).single()) as {
      time_limit_seconds: number | null;
    };
    const { untimed_mode } = unwrap(await db.from('profiles').select('untimed_mode').eq('id', ctx.userId).single()) as {
      untimed_mode: boolean;
    };
    
    timer = { perQuestionSeconds: untimed_mode ? null : quiz.time_limit_seconds, untimed: untimed_mode };
  }
  return { attempt: camelize(a), answered: camelize<unknown[]>(answers), total, timer, isOpen: a.finished_at === null };
}


export async function startAttempt(ctx: AuthContext, input: z.infer<typeof startSchema>) {
  const a = unwrap(await ctx.db.rpc('start_attempt', { p_activity: input.activity, p_target: input.targetId })) as Attempt;
  const state = await attemptState(ctx, a);
  return { ...state, resumed: state.answered.length > 0 };
}


export async function getAttempt(ctx: AuthContext, id: string) {
  return attemptState(ctx, await loadAttempt(ctx, id));
}

export async function attemptActivity(ctx: AuthContext, id: string): Promise<Activity> {
  return (await loadAttempt(ctx, id)).activity;
}







async function effectiveTimeMs(ctx: AuthContext, a: Attempt, clientMs: number): Promise<number> {
  const last = unwrap(
    await ctx.db.from('answers').select('answered_at').eq('attempt_id', a.id).order('answered_at', { ascending: false }).limit(1),
  ) as { answered_at: string }[];
  const since = new Date(last[0]?.answered_at ?? a.started_at).getTime();
  const serverGap = Math.max(Date.now() - since - FEEDBACK_ALLOWANCE_MS, 0);
  return Math.max(clientMs, serverGap);
}

type AnswerBody = {
  [K in Activity]: z.infer<(typeof answerSchemas)[K]>;
};


export async function answer<A extends Activity>(ctx: AuthContext, id: string, activity: A, body: AnswerBody[A]) {
  const { db } = ctx;
  const a = await loadAttempt(ctx, id);
  if (a.activity !== activity) throw new AppError(422, 'business_rule', 'La respuesta no corresponde a esta actividad');
  if (a.finished_at) throw new AppError(422, 'business_rule', 'Este intento ya terminó');

  const b = body as AnswerBody[Activity];
  let result: unknown;
  switch (activity) {
    case 'quiz': {
      const q = b as AnswerBody['quiz'];
      result = await db.rpc('answer_quiz_question', {
        p_attempt: id,
        p_question: q.questionId,
        p_option: q.optionId,
        p_time_ms: await effectiveTimeMs(ctx, a, q.timeMs),
      });
      break;
    }
    case 'dilemma': {
      const q = b as AnswerBody['dilemma'];
      result = await db.rpc('answer_dilemma', {
        p_attempt: id,
        p_option: q.optionId,
        p_justification: q.justification ?? null,
        p_time_ms: q.timeMs,
      });
      break;
    }
    case 'fill_blank': {
      const q = b as AnswerBody['fill_blank'];
      result = await db.rpc('answer_fill_blank', { p_attempt: id, p_item: q.itemId, p_text: q.text, p_time_ms: q.timeMs });
      break;
    }
    case 'memory_match': {
      const q = b as AnswerBody['memory_match'];
      result = await db.rpc('submit_memory_match', { p_attempt: id, p_matches: q.matches, p_time_ms: q.timeMs });
      break;
    }
  }
  return camelize(unwrap(result as Parameters<typeof unwrap>[0]));
}


export async function finishAttempt({ db }: AuthContext, id: string) {
  return camelize(unwrap(await db.rpc('finish_attempt', { p_attempt: id })));
}


export async function history({ db, userId }: AuthContext, q: z.infer<typeof historyQuery>) {
  const { from, to } = pageRange(q);
  let query = db
    .from('attempts')
    .select(`${ATTEMPT_COLUMNS}, quiz:quizzes(title), dilemma:dilemmas(title), module:modules(title)`, { count: 'exact' })
    .eq('student_id', userId)
    .not('finished_at', 'is', null);
  if (q.activity) query = query.eq('activity', q.activity);
  const { data, error, count } = await query.order('finished_at', { ascending: false }).range(from, to);
  if (error) throw error;
  return { items: camelize(data), total: count ?? 0, page: q.page, pageSize: q.pageSize };
}



const CHEAT_MIN_SCORE = 90;
const CHEAT_MAX_AVG_MS = 1500;
const CHEAT_MIN_ANSWERS = 5;







export async function listSuspicious(_ctx: AuthContext, limit: number) {
  const admin = serviceClient();
  const attempts = unwrap(
    await admin
      .from('attempts')
      .select('id, student_id, activity, score, xp_earned, finished_at, student:profiles(username)')
      .eq('activity', 'quiz')
      .not('finished_at', 'is', null)
      .gte('score', CHEAT_MIN_SCORE)
      .gt('xp_earned', 0)
      .order('finished_at', { ascending: false })
      .limit(500),
  ) as unknown as {
    id: string;
    student_id: string;
    score: number;
    xp_earned: number;
    finished_at: string;
    student: { username: string } | { username: string }[] | null;
  }[];
  if (!attempts.length) return [];

  const answers = unwrap(
    await admin.from('answers').select('attempt_id, time_ms').in('attempt_id', attempts.map((a) => a.id)),
  ) as { attempt_id: string; time_ms: number }[];
  const times = new Map<string, number[]>();
  for (const r of answers) times.set(r.attempt_id, [...(times.get(r.attempt_id) ?? []), r.time_ms]);

  return attempts
    .flatMap((a) => {
      const t = times.get(a.id) ?? [];
      const avgMs = t.length ? t.reduce((x, y) => x + y, 0) / t.length : null;
      if (t.length < CHEAT_MIN_ANSWERS || avgMs === null || avgMs >= CHEAT_MAX_AVG_MS) return [];
      const student = Array.isArray(a.student) ? a.student[0] : a.student;
      return [
        {
          attemptId: a.id,
          studentId: a.student_id,
          score: a.score,
          xpEarned: a.xp_earned,
          finishedAt: a.finished_at,
          username: student?.username ?? null,
          answers: t.length,
          avgSeconds: Math.round(avgMs / 100) / 10,
          reason: `Promedio de ${(avgMs / 1000).toFixed(1)} s por respuesta con calificación ${a.score}`,
        },
      ];
    })
    .slice(0, limit);
}






export async function confirmCheat(_ctx: AuthContext, attemptId: string) {
  const admin = serviceClient();
  const a = unwrap(
    await admin
      .from('attempts')
      .select('id, student_id, module_id, xp_earned, finished_at, quiz:quizzes(module_id), dilemma:dilemmas(module_id)')
      .eq('id', attemptId)
      .maybeSingle(),
  ) as unknown as {
    id: string;
    student_id: string;
    module_id: string | null;
    xp_earned: number;
    finished_at: string | null;
    quiz: { module_id: string | null } | null;
    dilemma: { module_id: string | null } | null;
  };
  if (!a.finished_at) throw new AppError(422, 'business_rule', 'El intento aún no termina');
  if (a.xp_earned <= 0) throw new AppError(422, 'business_rule', 'Este intento no tiene XP que anular');

  const claim = await admin.from('attempts').update({ xp_earned: 0 }).eq('id', a.id).eq('xp_earned', a.xp_earned).select('id');
  if (claim.error) throw claim.error;
  if (!claim.data?.length) throw new AppError(409, 'conflict', 'Este intento ya fue revisado');

  const xp = await admin.rpc('award_xp', { p_student: a.student_id, p_amount: -a.xp_earned, p_reason: 'adjustment', p_source: a.id });
  if (xp.error) throw xp.error;

  let revoked = 0;
  const moduleId = a.module_id ?? a.quiz?.module_id ?? a.dilemma?.module_id ?? null;
  if (moduleId) {
    const mod = unwrap(await admin.from('modules').select('path_id').eq('id', moduleId).maybeSingle()) as { path_id: string | null };
    if (mod.path_id) {
      const rev = await admin
        .from('certificates')
        .update({ revoked: true })
        .eq('student_id', a.student_id)
        .eq('path_id', mod.path_id)
        .select('id');
      if (rev.error) throw rev.error;
      revoked = rev.data?.length ?? 0;
    }
  }
  return { attemptId: a.id, xpAnnulled: a.xp_earned, certificatesRevoked: revoked };
}
