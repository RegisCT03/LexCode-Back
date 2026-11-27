import type { z } from 'zod';
import type { AuthContext } from '@/lib/auth';
import { AppError, conflict, forbidden, notFound } from '@/lib/errors';
import { serviceClient, unwrap } from '@/lib/supabase';
import type * as S from './schemas';

type Row = Record<string, unknown>;

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


async function loadGameModule({ db, profile }: AuthContext, id: string, type: 'memory_match' | 'fill_blank') {
  const m = unwrap(
    await db.from('modules').select('id, title, standard, interaction_type, xp_reward, is_published').eq('id', id).maybeSingle(),
  ) as { id: string; title: string; standard: string | null; interaction_type: string; xp_reward: number; is_published: boolean };
  if (m.interaction_type !== type) throw new AppError(422, 'business_rule', 'Este módulo no es de esa actividad');
  if (!m.is_published && profile.role === 'student') throw notFound();
  return m;
}


export async function catalog({ db, userId }: AuthContext) {
  const [quizzes, games, progress] = await Promise.all([
    db
      .from('quizzes')
      .select('id, slug, title, description, area, time_limit_seconds, max_attempts')
      .is('group_id', null)
      .eq('is_published', true)
      .order('title'),
    db
      .from('modules')
      .select('id, path_id, title, standard, interaction_type, xp_reward, prerequisite_id')
      .in('interaction_type', ['memory_match', 'fill_blank'])
      .eq('is_published', true)
      .not('path_id', 'is', null)
      .order('sort_order'),
    db.from('module_progress').select('module_id, status').eq('student_id', userId),
  ]);
  if (quizzes.error) throw quizzes.error;
  if (games.error) throw games.error;
  if (progress.error) throw progress.error;
  const done = new Set(progress.data.filter((p) => p.status === 'completed').map((p) => p.module_id));
  const withState = (m: Row): Row => ({ ...m, completed: done.has(m.id as string), unlocked: !m.prerequisite_id || done.has(m.prerequisite_id as string) });
  const list = (games.data as Row[]).map(withState);
  return {
    audit: quizzes.data,
    memoryMatch: list.filter((m) => m.interaction_type === 'memory_match'),
    fillBlank: list.filter((m) => m.interaction_type === 'fill_blank'),
  };
}






export async function getMemoryMatch(ctx: AuthContext, moduleId: string) {
  const mod = await loadGameModule(ctx, moduleId, 'memory_match');
  const pairs = unwrap(
    await ctx.db.from('memory_pairs').select('id, concept, definition').eq('module_id', moduleId).order('sort_order'),
  ) as { id: string; concept: string; definition: string }[];
  return {
    module: mod,
    total: pairs.length,
    concepts: shuffle(pairs.map((p) => ({ id: p.id, text: p.concept }))),
    definitions: shuffle(pairs.map((p) => ({ id: p.id, text: p.definition }))),
  };
}


export async function getFillBlank(ctx: AuthContext, moduleId: string) {
  const mod = await loadGameModule(ctx, moduleId, 'fill_blank');
  const items = unwrap(
    await ctx.db
      .from('fill_blank_items')
      .select('id, rule_title, prefix, suffix, options, sort_order')
      .eq('module_id', moduleId)
      .order('sort_order'),
  ) as (Row & { options: string[] })[];
  return { module: mod, total: items.length, items: items.map((i) => ({ ...i, options: shuffle(i.options) })) };
}



async function assertCanEdit({ db, profile }: AuthContext, moduleId: string) {
  const m = unwrap(await db.from('modules').select('id, group_id').eq('id', moduleId).maybeSingle()) as {
    id: string;
    group_id: string | null;
  };
  if (profile.role === 'admin') return;
  if (profile.role === 'teacher' && m.group_id && unwrap(await db.rpc('is_group_teacher', { p_group_id: m.group_id }))) return;
  throw forbidden();
}


export async function getEditableMemory(ctx: AuthContext, moduleId: string) {
  await assertCanEdit(ctx, moduleId);
  return unwrap(await ctx.db.from('memory_pairs').select('id, concept, definition, sort_order').eq('module_id', moduleId).order('sort_order'));
}


export async function getEditableFillBlank(ctx: AuthContext, moduleId: string) {
  await assertCanEdit(ctx, moduleId);
  return unwrap(
    await serviceClient()
      .from('fill_blank_items')
      .select('id, rule_title, prefix, suffix, answer, options, sort_order')
      .eq('module_id', moduleId)
      .order('sort_order'),
  );
}





async function replaceItems(ctx: AuthContext, table: 'memory_pairs' | 'fill_blank_items', moduleId: string, rows: Row[]) {
  await assertCanEdit(ctx, moduleId);
  const { db } = ctx;
  const payload = rows.map((r, i) => ({ ...r, module_id: moduleId, sort_order: i + 1 }));
  const up = await db.from(table).upsert(payload, { onConflict: 'module_id,sort_order' });
  if (up.error) throw up.error;
  const del = await db.from(table).delete().eq('module_id', moduleId).gt('sort_order', payload.length);
  if (del.error) {
    if (del.error.code === '23503') throw conflict('Hay respuestas de estudiantes en las parejas o frases sobrantes; no se pueden quitar', 'has_answers');
    throw del.error;
  }
  return { saved: payload.length };
}

export async function saveMemoryPairs(ctx: AuthContext, moduleId: string, input: z.infer<typeof S.memoryPairsSchema>) {
  return replaceItems(ctx, 'memory_pairs', moduleId, input.pairs);
}

export async function saveFillBlank(ctx: AuthContext, moduleId: string, input: z.infer<typeof S.fillBlankSchema>) {
  const rows = input.items.map((i) => ({
    rule_title: i.ruleTitle,
    prefix: i.prefix,
    suffix: i.suffix,
    answer: i.answer,
    options: i.options,
  }));
  return replaceItems(ctx, 'fill_blank_items', moduleId, rows);
}
