import type { z } from 'zod';
import type { AuthContext } from '@/lib/auth';
import { AppError, notFound } from '@/lib/errors';
import { unwrap } from '@/lib/supabase';
import { pageRange } from '@/lib/validation';
import type * as S from './schemas';

const GROUP_COLUMNS = 'id, teacher_id, institution_id, name, subject, invite_code, term, is_active, created_at';


const hideCode = <T extends object>(ctx: AuthContext, g: T) =>
  ctx.profile.role === 'student' ? Object.fromEntries(Object.entries(g).filter(([k]) => k !== 'invite_code')) : g;


export async function createGroup({ db, userId }: AuthContext, input: z.infer<typeof S.groupCreateSchema>) {
  const { institution_id } = unwrap(await db.from('profiles').select('institution_id').eq('id', userId).single()) as {
    institution_id: string | null;
  };
  
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = unwrap(await db.rpc('random_code', { p_length: 8 })) as string;
    const { data, error } = await db
      .from('groups')
      .insert({
        teacher_id: userId,
        institution_id,
        name: input.name,
        subject: input.subject ?? null,
        term: input.term ?? null,
        invite_code: code,
      })
      .select(GROUP_COLUMNS)
      .single();
    if (!error) return data;
    if (error.code !== '23505') throw error;
  }
  throw new AppError(500, 'invite_code_unavailable', 'No se pudo generar el código del grupo, inténtalo de nuevo');
}


export async function listGroups(ctx: AuthContext) {
  const { db, userId, profile } = ctx;
  if (profile.role === 'student') {
    const rows = unwrap(await db.from('groups').select(GROUP_COLUMNS).order('created_at', { ascending: false })) as object[];
    return rows.map((g) => hideCode(ctx, g));
  }
  const rows = unwrap(
    await db
      .from('groups')
      .select(`${GROUP_COLUMNS}, members:group_members(count)`)
      .eq('teacher_id', userId)
      .order('created_at', { ascending: false }),
  ) as { members: { count: number }[] }[];
  return rows.map(({ members, ...g }) => ({ ...g, student_count: members[0]?.count ?? 0 }));
}


export async function getGroup(ctx: AuthContext, id: string) {
  const { db, profile } = ctx;
  const group = unwrap(await db.from('groups').select(GROUP_COLUMNS).eq('id', id).maybeSingle()) as Record<string, unknown>;
  if (profile.role === 'student') return hideCode(ctx, group);
  const students = unwrap(
    await db
      .from('v_teacher_group_progress')
      .select('student_id, full_name, student_number, xp_total, level, status, average_score, modules_completed, current_module, last_activity_at')
      .eq('group_id', id)
      .order('full_name'),
  );
  return { ...group, students };
}

export async function updateGroup({ db }: AuthContext, id: string, input: z.infer<typeof S.groupUpdateSchema>) {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.subject !== undefined) patch.subject = input.subject;
  if (input.term !== undefined) patch.term = input.term;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  const { data, error } = await db.from('groups').update(patch).eq('id', id).select(GROUP_COLUMNS);
  if (error) throw error;
  if (!data?.length) throw notFound('No existe ese grupo');
  return data[0];
}


export async function joinGroup({ db }: AuthContext, input: z.infer<typeof S.joinSchema>) {
  const groupId = unwrap(await db.rpc('join_group', { p_invite_code: input.inviteCode })) as string;
  const group = unwrap(await db.from('groups').select('id, name, subject, term, is_active').eq('id', groupId).single());
  return group;
}


export async function removeMember({ db }: AuthContext, groupId: string, studentId: string) {
  const { error, count } = await db
    .from('group_members')
    .delete({ count: 'exact' })
    .eq('group_id', groupId)
    .eq('student_id', studentId);
  if (error) throw error;
  if (!count) throw notFound('Esa persona no está en el grupo');
  return { removed: true };
}


export async function addComment({ db, userId }: AuthContext, groupId: string, input: z.infer<typeof S.commentSchema>) {
  const { error } = await db
    .from('teacher_comments')
    .insert({ teacher_id: userId, student_id: input.studentId, group_id: groupId, body: input.body });
  if (error) throw error;
  return { sent: true };
}


export async function listComments({ db }: AuthContext, q: z.infer<typeof S.commentsQuery>) {
  const { from, to } = pageRange(q);
  let query = db
    .from('teacher_comments')
    .select('id, teacher_id, student_id, group_id, body, created_at', { count: 'exact' });
  if (q.groupId) query = query.eq('group_id', q.groupId);
  if (q.studentId) query = query.eq('student_id', q.studentId);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  return { items: data, total: count ?? 0, page: q.page, pageSize: q.pageSize };
}
