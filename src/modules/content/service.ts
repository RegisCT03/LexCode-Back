import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import type { AuthContext } from '@/lib/auth';
import { AppError, conflict, forbidden, notFound } from '@/lib/errors';
import { serviceClient, unwrap } from '@/lib/supabase';
import { pageRange } from '@/lib/validation';
import type * as S from './schemas';

type Row = Record<string, unknown>;

const MODULE_LIST_COLUMNS = 'id, path_id, group_id, title, standard, interaction_type, sort_order, xp_reward, prerequisite_id';
const REFERENCE = 'legal_reference:legal_references(law, article, summary, official_url)';



export async function listPaths({ db, userId }: AuthContext) {
  const paths = unwrap(
    await db
      .from('learning_paths')
      .select('id, slug, title, description, area, sort_order')
      .eq('is_published', true)
      .order('sort_order'),
  ) as Row[];
  const modules = unwrap(
    await db
      .from('modules')
      .select(MODULE_LIST_COLUMNS)
      .not('path_id', 'is', null)
      .eq('is_published', true)
      .order('sort_order'),
  ) as Row[];
  const progress = unwrap(
    await db.from('module_progress').select('module_id, status, percent').eq('student_id', userId),
  ) as { module_id: string; status: string; percent: number }[];

  const byModule = new Map(progress.map((p) => [p.module_id, p]));
  const done = new Set(progress.filter((p) => p.status === 'completed').map((p) => p.module_id));

  return paths.map((path) => {
    const mine = modules.filter((m) => m.path_id === path.id).map((m) => {
      const p = byModule.get(m.id as string);
      const unlocked = !m.prerequisite_id || done.has(m.prerequisite_id as string);
      return {
        ...m,
        status: p?.status ?? (unlocked ? 'available' : 'locked'),
        percent: p?.percent ?? 0,
        unlocked,
      };
    });
    const completed = mine.filter((m) => m.status === 'completed').length;
    return { ...path, modules: mine, completed, total: mine.length };
  });
}


export async function getModule({ db, userId, profile }: AuthContext, id: string) {
  const mod = unwrap(
    await db
      .from('modules')
      .select(`${MODULE_LIST_COLUMNS}, content, is_published`)
      .eq('id', id)
      .maybeSingle(),
  ) as Row;

  if (profile.role === 'student') {
    const unlocked = unwrap(await db.rpc('module_unlocked', { p_student: userId, p_module: id })) as boolean;
    if (!unlocked) throw new AppError(403, 'module_locked', 'Completa primero el módulo anterior');
  }

  const [progress, quizzes, dilemmas] = await Promise.all([
    db.from('module_progress').select('status, percent, completed_at').eq('student_id', userId).eq('module_id', id).maybeSingle(),
    db.from('quizzes').select('id, title, description, time_limit_seconds, max_attempts, due_at').eq('module_id', id).eq('is_published', true),
    db.from('dilemmas').select('id, number, title').eq('module_id', id).eq('is_published', true).order('number'),
  ]);
  if (progress.error) throw progress.error;
  if (quizzes.error) throw quizzes.error;
  if (dilemmas.error) throw dilemmas.error;
  return { ...mod, progress: progress.data, quizzes: quizzes.data, dilemmas: dilemmas.data };
}


export async function listDilemmas({ db }: AuthContext) {
  return unwrap(await db.rpc('get_my_dilemmas'));
}


export async function getDilemma({ db, userId }: AuthContext, id: string) {
  const dilemma = unwrap(
    await db
      .from('dilemmas')
      .select(
        'id, module_id, number, title, category, subtitle, scenario, law_quote, is_weekly, week_start, ' +
          `options:dilemma_options(id, label, body), ${REFERENCE}`,
      )
      .eq('id', id)
      .maybeSingle(),
  ) as unknown as Row & { options: { label: string }[] };
  const unlocked = unwrap(await db.rpc('dilemma_unlocked', { p_student: userId, p_dilemma: id })) as boolean;
  dilemma.options.sort((a, b) => a.label.localeCompare(b.label));
  return { ...dilemma, status: unlocked ? 'active' : 'locked' };
}

export async function listQuizzes({ db }: AuthContext, q: z.infer<typeof S.quizListQuery>) {
  const { from, to } = pageRange(q);
  let query = db
    .from('quizzes')
    .select('id, module_id, group_id, slug, title, description, area, time_limit_seconds, max_attempts, due_at, is_published', {
      count: 'exact',
    });
  if (q.moduleId) query = query.eq('module_id', q.moduleId);
  if (q.groupId) query = query.eq('group_id', q.groupId);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  return { items: data, total: count ?? 0, page: q.page, pageSize: q.pageSize };
}


export async function getQuiz({ db }: AuthContext, id: string) {
  const quiz = unwrap(
    await db
      .from('quizzes')
      .select(
        'id, module_id, group_id, title, description, area, time_limit_seconds, max_attempts, due_at, ' +
          'questions:quiz_questions(id, prompt, type, sort_order, xp_correct, xp_wrong, options:quiz_options(id, label, body))',
      )
      .eq('id', id)
      .maybeSingle(),
  ) as unknown as Row & { questions: { sort_order: number; options: { label: string }[] }[] };
  quiz.questions.sort((a, b) => a.sort_order - b.sort_order);
  quiz.questions.forEach((qq) => qq.options.sort((a, b) => a.label.localeCompare(b.label)));
  return quiz;
}


const pathRow = (i: Partial<z.infer<typeof S.pathCreateSchema>>) => {
  const r: Row = {};
  if (i.slug !== undefined) r.slug = i.slug;
  if (i.title !== undefined) r.title = i.title;
  if (i.description !== undefined) r.description = i.description;
  if (i.area !== undefined) r.area = i.area;
  if (i.sortOrder !== undefined) r.sort_order = i.sortOrder;
  if (i.isPublished !== undefined) r.is_published = i.isPublished;
  return r;
};


export async function adminListPaths({ db }: AuthContext) {
  return unwrap(
    await db
      .from('learning_paths')
      .select('id, slug, title, description, area, sort_order, is_published, modules(id)')
      .order('sort_order'),
  ).map(({ modules, ...p }: Row & { modules: unknown[] }) => ({ ...p, module_count: modules.length }));
}



export async function createPath(_ctx: AuthContext, input: z.infer<typeof S.pathCreateSchema>) {
  return unwrap(await serviceClient().from('learning_paths').insert(pathRow(input)).select().single());
}

export async function updatePath(_ctx: AuthContext, id: string, input: z.infer<typeof S.pathUpdateSchema>) {
  const { data, error } = await serviceClient().from('learning_paths').update(pathRow(input)).eq('id', id).select();
  if (error) throw error;
  if (!data?.length) throw notFound('No existe esa ruta');
  return data[0];
}

export async function deletePath(_ctx: AuthContext, id: string) {
  const { error, count } = await serviceClient().from('learning_paths').delete({ count: 'exact' }).eq('id', id);
  if (error) throw error;
  if (!count) throw notFound('No existe esa ruta');
  return { deleted: true };
}


const moduleRow = (i: Partial<z.infer<typeof S.moduleCreateSchema>>) => {
  const r: Row = {};
  if (i.pathId !== undefined) r.path_id = i.pathId;
  if (i.title !== undefined) r.title = i.title;
  if (i.standard !== undefined) r.standard = i.standard;
  if (i.content !== undefined) r.content = i.content;
  if (i.interactionType !== undefined) r.interaction_type = i.interactionType;
  if (i.sortOrder !== undefined) r.sort_order = i.sortOrder;
  if (i.xpReward !== undefined) r.xp_reward = i.xpReward;
  if (i.prerequisiteId !== undefined) r.prerequisite_id = i.prerequisiteId;
  if (i.isPublished !== undefined) r.is_published = i.isPublished;
  return r;
};

export async function createModule({ db, userId }: AuthContext, input: z.infer<typeof S.moduleCreateSchema>) {
  return unwrap(await db.from('modules').insert({ ...moduleRow(input), created_by: userId }).select().single());
}

export async function updateModule({ db }: AuthContext, id: string, input: z.infer<typeof S.moduleUpdateSchema>) {
  if (input.prerequisiteId === id) throw new AppError(422, 'business_rule', 'Un módulo no puede ser su propio requisito');
  const { data, error } = await db.from('modules').update(moduleRow(input)).eq('id', id).select();
  if (error) throw error;
  if (!data?.length) throw notFound('No existe ese módulo');
  return data[0];
}

export async function deleteModule({ db }: AuthContext, id: string) {
  const { error, count } = await db.from('modules').delete({ count: 'exact' }).eq('id', id);
  if (error) throw error;
  if (!count) throw notFound('No existe ese módulo');
  return { deleted: true };
}





export async function orderModules({ db }: AuthContext, pathId: string, input: z.infer<typeof S.moduleOrderSchema>) {
  const current = unwrap(await db.from('modules').select('id').eq('path_id', pathId)) as { id: string }[];
  const ids = new Set(current.map((m) => m.id));
  if (input.moduleIds.length !== ids.size || input.moduleIds.some((m) => !ids.has(m))) {
    throw new AppError(422, 'business_rule', 'La lista debe incluir exactamente los módulos de la ruta');
  }
  for (const [i, id] of input.moduleIds.entries()) {
    const { error } = await db.from('modules').update({ sort_order: 1000 + i }).eq('id', id);
    if (error) throw error;
  }
  for (const [i, id] of input.moduleIds.entries()) {
    const { error } = await db.from('modules').update({ sort_order: i + 1 }).eq('id', id);
    if (error) throw error;
  }
  return { pathId, moduleIds: input.moduleIds };
}


const dilemmaRow = (i: Partial<z.infer<typeof S.dilemmaCreateSchema>>) => {
  const r: Row = {};
  if (i.moduleId !== undefined) r.module_id = i.moduleId;
  if (i.number !== undefined) r.number = i.number;
  if (i.title !== undefined) r.title = i.title;
  if (i.category !== undefined) r.category = i.category;
  if (i.subtitle !== undefined) r.subtitle = i.subtitle;
  if (i.scenario !== undefined) r.scenario = i.scenario;
  if (i.lawQuote !== undefined) r.law_quote = i.lawQuote;
  if (i.legalReferenceId !== undefined) r.legal_reference_id = i.legalReferenceId;
  if (i.isPublished !== undefined) r.is_published = i.isPublished;
  return r;
};

type DilemmaOption = z.infer<typeof S.dilemmaCreateSchema>['options'][number];
const optionRow = (dilemmaId: string, o: DilemmaOption) => ({
  dilemma_id: dilemmaId,
  label: o.label,
  body: o.body,
  is_expected: o.isExpected,
  xp_delta: o.xpDelta,
  feedback_title: o.feedbackTitle,
  feedback_text: o.feedbackText,
  sanction: o.sanction ?? null,
});


export async function adminGetDilemma(_ctx: AuthContext, id: string) {
  const d = unwrap(
    await serviceClient()
      .from('dilemmas')
      .select(`*, options:dilemma_options(*), ${REFERENCE}`)
      .eq('id', id)
      .maybeSingle(),
  ) as Row & { options: { label: string }[] };
  d.options.sort((a, b) => a.label.localeCompare(b.label));
  return d;
}

export async function adminListDilemmas({ db }: AuthContext) {
  return unwrap(
    await db
      .from('dilemmas')
      .select('id, module_id, number, title, category, is_weekly, week_start, is_published')
      .order('number'),
  );
}

export async function createDilemma(ctx: AuthContext, input: z.infer<typeof S.dilemmaCreateSchema>) {
  const db = serviceClient();
  const { id } = unwrap(await db.from('dilemmas').insert(dilemmaRow(input)).select('id').single()) as { id: string };
  const { error } = await db.from('dilemma_options').insert(input.options.map((o) => optionRow(id, o)));
  if (error) {
    await db.from('dilemmas').delete().eq('id', id); 
    throw error;
  }
  return adminGetDilemma(ctx, id);
}

export async function updateDilemma(ctx: AuthContext, id: string, input: z.infer<typeof S.dilemmaUpdateSchema>) {
  const db = serviceClient();
  const { options, ...fields } = input;
  const patch = dilemmaRow(fields);
  if (Object.keys(patch).length) {
    const { data, error } = await db.from('dilemmas').update(patch).eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) throw notFound('No existe ese dilema');
  }
  if (options) {
    
    const ordered = [...options].sort((a, b) => Number(a.isExpected) - Number(b.isExpected));
    for (const o of ordered) {
      const { error } = await db.from('dilemma_options').upsert(optionRow(id, o), { onConflict: 'dilemma_id,label' });
      if (error) throw error;
    }
  }
  return adminGetDilemma(ctx, id);
}

export async function deleteDilemma(_ctx: AuthContext, id: string) {
  const { error, count } = await serviceClient().from('dilemmas').delete({ count: 'exact' }).eq('id', id);
  if (error) {
    if (error.code === '23503') throw conflict('Este dilema ya tiene respuestas; despublícalo en lugar de borrarlo', 'has_answers');
    throw error;
  }
  if (!count) throw notFound('No existe ese dilema');
  return { deleted: true };
}


export async function setWeeklyDilemma(_ctx: AuthContext, input: z.infer<typeof S.weeklyDilemmaSchema>) {
  const db = serviceClient();
  const clear = await db
    .from('dilemmas')
    .update({ is_weekly: false, week_start: null })
    .eq('is_weekly', true)
    .eq('week_start', input.weekStart)
    .neq('id', input.dilemmaId);
  if (clear.error) throw clear.error;
  const { data, error } = await db
    .from('dilemmas')
    .update({ is_weekly: true, week_start: input.weekStart })
    .eq('id', input.dilemmaId)
    .select('id, title, is_weekly, week_start');
  if (error) throw error;
  if (!data?.length) throw notFound('No existe ese dilema');
  return data[0];
}


type QuizQuestion = z.infer<typeof S.quizCreateSchema>['questions'][number];

async function insertQuestions(db: SupabaseClient, quizId: string, questions: QuizQuestion[]) {
  for (const [i, q] of questions.entries()) {
    const { id } = unwrap(
      await db
        .from('quiz_questions')
        .insert({
          quiz_id: quizId,
          prompt: q.prompt,
          type: q.type,
          explanation: q.explanation,
          legal_reference_id: q.legalReferenceId ?? null,
          xp_correct: q.xpCorrect,
          xp_wrong: q.xpWrong,
          sort_order: i + 1,
        })
        .select('id')
        .single(),
    ) as { id: string };
    const { error } = await db
      .from('quiz_options')
      .insert(q.options.map((o) => ({ question_id: id, label: o.label, body: o.body, is_correct: o.isCorrect })));
    if (error) throw error;
  }
}

const quizRow = (i: Partial<z.infer<typeof S.quizCreateSchema>>) => {
  const r: Row = {};
  if (i.slug !== undefined) r.slug = i.slug;
  if (i.title !== undefined) r.title = i.title;
  if (i.description !== undefined) r.description = i.description;
  if (i.area !== undefined) r.area = i.area;
  if (i.timeLimitSeconds !== undefined) r.time_limit_seconds = i.timeLimitSeconds;
  if (i.maxAttempts !== undefined) r.max_attempts = i.maxAttempts;
  if (i.dueAt !== undefined) r.due_at = i.dueAt;
  if (i.isPublished !== undefined) r.is_published = i.isPublished;
  return r;
};


export async function getEditableQuiz({ db }: AuthContext, id: string) {
  return unwrap(await db.rpc('get_editable_quiz', { p_quiz: id }));
}

export async function createQuiz(ctx: AuthContext, input: z.infer<typeof S.quizCreateSchema>) {
  const { db, userId, profile } = ctx;
  
  if (profile.role === 'teacher' && (!input.groupId || input.moduleId)) throw forbidden('Los docentes solo crean quizzes para su grupo');
  if (profile.role === 'student') throw forbidden();

  const { questions, moduleId, groupId, ...fields } = input;
  const { id } = unwrap(
    await db
      .from('quizzes')
      .insert({ ...quizRow(fields), module_id: moduleId ?? null, group_id: groupId ?? null, created_by: userId })
      .select('id')
      .single(),
  ) as { id: string };
  try {
    await insertQuestions(db, id, questions);
  } catch (err) {
    await db.from('quizzes').delete().eq('id', id); 
    throw err;
  }
  return getEditableQuiz(ctx, id);
}

export async function updateQuiz(ctx: AuthContext, id: string, input: z.infer<typeof S.quizUpdateSchema>) {
  const { db } = ctx;
  const { questions, ...fields } = input;
  await getEditableQuiz(ctx, id); 

  const patch = quizRow(fields);
  if (Object.keys(patch).length) {
    const { error } = await db.from('quizzes').update(patch).eq('id', id);
    if (error) throw error;
  }
  if (questions) {
    const attempts = await db.from('attempts').select('id', { count: 'exact', head: true }).eq('quiz_id', id);
    if (attempts.error) throw attempts.error;
    if (attempts.count) throw conflict('Este quiz ya tiene intentos; no se pueden reemplazar sus preguntas', 'quiz_has_attempts');
    const del = await db.from('quiz_questions').delete().eq('quiz_id', id);
    if (del.error) throw del.error;
    await insertQuestions(db, id, questions);
  }
  return getEditableQuiz(ctx, id);
}

export async function deleteQuiz({ db }: AuthContext, id: string) {
  const { error, count } = await db.from('quizzes').delete({ count: 'exact' }).eq('id', id);
  if (error) {
    if (error.code === '23503') throw conflict('Este quiz ya tiene respuestas; despublícalo en lugar de borrarlo', 'has_answers');
    throw error;
  }
  if (!count) throw notFound('No existe ese quiz');
  return { deleted: true };
}
