import type { z } from 'zod';
import type { AuthContext } from '@/lib/auth';
import { forbidden } from '@/lib/errors';
import { unwrap } from '@/lib/supabase';
import type { progressQuery } from './schemas';








type ModuleRow = { id: string; path_id: string; title: string; standard: string | null; interaction_type: string; sort_order: number; xp_reward: number; prerequisite_id: string | null };
type ProgressRow = { module_id: string; status: 'in_progress' | 'completed'; percent: number; started_at: string; completed_at: string | null };


export async function getProgress(ctx: AuthContext, q: z.infer<typeof progressQuery>) {
  const { db, userId, profile } = ctx;
  const studentId = q.studentId ?? userId;
  if (studentId !== userId && profile.role === 'student') throw forbidden();

  const [paths, modules, progress, certs] = await Promise.all([
    db.from('learning_paths').select('id, slug, title, area, sort_order').eq('is_published', true).order('sort_order'),
    db
      .from('modules')
      .select('id, path_id, title, standard, interaction_type, sort_order, xp_reward, prerequisite_id')
      .not('path_id', 'is', null)
      .eq('is_published', true)
      .order('sort_order'),
    db.from('module_progress').select('module_id, status, percent, started_at, completed_at').eq('student_id', studentId),
    db.from('certificates').select('id, path_id, folio, final_score, issued_at, revoked').eq('student_id', studentId),
  ]);
  for (const r of [paths, modules, progress, certs]) if (r.error) throw r.error;

  const byModule = new Map((progress.data as ProgressRow[]).map((p) => [p.module_id, p]));
  const done = new Set((progress.data as ProgressRow[]).filter((p) => p.status === 'completed').map((p) => p.module_id));

  return (paths.data as { id: string }[]).map((path) => {
    const mods = (modules.data as ModuleRow[])
      .filter((m) => m.path_id === path.id)
      .map((m) => {
        const p = byModule.get(m.id);
        const unlocked = !m.prerequisite_id || done.has(m.prerequisite_id);
        return {
          ...m,
          unlocked,
          status: p?.status ?? (unlocked ? 'available' : 'locked'),
          percent: p?.percent ?? 0,
          started_at: p?.started_at ?? null,
          completed_at: p?.completed_at ?? null,
        };
      });
    const completed = mods.filter((m) => m.status === 'completed').length;
    const certificate = (certs.data as { path_id: string }[]).find((c) => c.path_id === path.id) ?? null;
    return {
      ...path,
      modules: mods,
      completed,
      total: mods.length,
      percent: mods.length ? Math.round((100 * completed) / mods.length) : 0,
      pathCompleted: mods.length > 0 && completed === mods.length,
      certificate,
    };
  });
}


export async function getModuleProgress({ db, userId }: AuthContext, moduleId: string) {
  const unlocked = unwrap(await db.rpc('module_unlocked', { p_student: userId, p_module: moduleId })) as boolean;
  const { data, error } = await db
    .from('module_progress')
    .select('status, percent, started_at, completed_at')
    .eq('student_id', userId)
    .eq('module_id', moduleId)
    .maybeSingle();
  if (error) throw error;
  return { moduleId, unlocked, status: data?.status ?? (unlocked ? 'available' : 'locked'), percent: data?.percent ?? 0, ...data };
}
