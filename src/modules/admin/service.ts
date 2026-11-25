import type { z } from 'zod';
import type { AuthContext } from '@/lib/auth';
import { fromAuth, notFound } from '@/lib/errors';
import { serviceClient, unwrap } from '@/lib/supabase';
import { pageRange } from '@/lib/validation';
import type * as S from './schemas';

/*
 * Todas las funciones reciben el contexto de un admin ya verificado (requireAdmin)
 * y usan SU sesión: RLS y las funciones admin_* de la base vuelven a revisar el
 * rol, y la bitácora registra quién hizo cada cambio.
 */

const paged = <T>(data: T[] | null, count: number | null, page: { page: number; pageSize: number }) => ({
  items: data ?? [],
  total: count ?? 0,
  page: page.page,
  pageSize: page.pageSize,
});

/**
 * Valor seguro para un filtro `or` de PostgREST: se quitan comodines y comillas,
 * y el valor va entre comillas dobles para que puntos, comas o arrobas
 * (p. ej. un correo) se busquen tal cual.
 */
const quotedPattern = (q: string) => `"*${q.replace(/["\\*%]/g, ' ').trim()}*"`;

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

// ---------------------------------------------------------------- Usuarios
const USER_COLUMNS =
  'id, full_name, username, email, role, status, institution_id, student_number, major, semester, ' +
  'xp_total, level, last_activity_date, deleted_at, created_at';

export async function listUsers({ db }: AuthContext, q: z.infer<typeof S.usersQuery>) {
  const { from, to } = pageRange(q);
  let query = db.from('profiles').select(USER_COLUMNS, { count: 'exact' });
  if (q.role) query = query.eq('role', q.role);
  if (q.status) query = query.eq('status', q.status);
  if (q.q?.trim()) {
    const p = quotedPattern(q.q);
    query = query.or(`full_name.ilike.${p},username.ilike.${p},email.ilike.${p}`);
  }
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  return paged(data, count, q);
}

export async function getUser({ db }: AuthContext, id: string) {
  const user = unwrap(await db.from('profiles').select(USER_COLUMNS).eq('id', id).maybeSingle());
  const consents = unwrap(
    await db
      .from('consents')
      .select('type, document_version, granted, guardian_email, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
  );
  return { ...(user as unknown as Record<string, unknown>), consents };
}

export async function setRole({ db }: AuthContext, id: string, role: z.infer<typeof S.roleSchema>['role']) {
  unwrap(await db.rpc('admin_set_user_role', { p_user: id, p_role: role }));
  return { id, role };
}

export async function setStatus({ db }: AuthContext, id: string, status: z.infer<typeof S.statusSchema>['status']) {
  unwrap(await db.rpc('admin_set_user_status', { p_user: id, p_status: status }));
  // Además se bloquea el inicio de sesión en Supabase Auth (y la renovación de tokens).
  const { error } = await serviceClient().auth.admin.updateUserById(id, {
    ban_duration: status === 'suspended' ? '876000h' : 'none',
  });
  if (error) throw fromAuth(error);
  return { id, status };
}

// ---------------------------------------------------------------- Reportes
export async function listReports({ db }: AuthContext, q: z.infer<typeof S.reportsQuery>) {
  const { from, to } = pageRange(q);
  let query = db
    .from('content_reports')
    .select(
      'id, reason, status, created_at, resolved_at, ' +
        'reporter:profiles!content_reports_reporter_id_fkey(id, username, full_name), ' +
        'target:profiles!content_reports_target_user_id_fkey(id, username, full_name)',
      { count: 'exact' },
    );
  if (q.status) query = query.eq('status', q.status);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  return paged(data, count, q);
}

export async function updateReport({ db }: AuthContext, id: string, status: z.infer<typeof S.reportUpdateSchema>['status']) {
  return unwrap(await db.rpc('admin_update_report', { p_report: id, p_status: status }));
}

// ---------------------------------------------------------------- ARCO
const ARCO_COLUMNS =
  'id, folio, user_id, contact_email, right, description, status, received_at, due_date, responded_at, response';

export async function listArco({ db }: AuthContext, q: z.infer<typeof S.arcoQuery>) {
  const { from, to } = pageRange(q);
  let query = db.from('arco_requests').select(ARCO_COLUMNS, { count: 'exact' });
  if (q.status) query = query.eq('status', q.status);
  const { data, error, count } = await query.order('due_date', { ascending: true }).range(from, to);
  if (error) throw error;
  return paged(data, count, q);
}

export async function updateArco({ db }: AuthContext, id: string, input: z.infer<typeof S.arcoUpdateSchema>) {
  const closing = ['approved', 'rejected', 'resolved', 'info_required'].includes(input.status);
  const patch: Record<string, unknown> = { status: input.status };
  if (input.response !== undefined) patch.response = input.response;
  if (closing) patch.responded_at = new Date().toISOString();
  const { data, error } = await db.from('arco_requests').update(patch).eq('id', id).select(ARCO_COLUMNS);
  if (error) throw error;
  if (!data?.length) throw notFound('No existe esa solicitud');
  return data[0];
}

// ---------------------------------------------------------------- Glosario
const toGlossaryRow = (i: Partial<z.infer<typeof S.glossaryCreateSchema>>) => {
  const row: Record<string, unknown> = {};
  if (i.slug !== undefined) row.slug = i.slug;
  if (i.term !== undefined) row.term = i.term;
  if (i.category !== undefined) row.category = i.category;
  if (i.definition !== undefined) row.definition = i.definition;
  if (i.legalCitation !== undefined) row.legal_citation = i.legalCitation;
  if (i.legalReferenceId !== undefined) row.legal_reference_id = i.legalReferenceId;
  if (i.lexisTip !== undefined) row.lexis_tip = i.lexisTip;
  return row;
};

export async function createTerm({ db }: AuthContext, input: z.infer<typeof S.glossaryCreateSchema>) {
  const row = toGlossaryRow({ ...input, slug: input.slug ?? slugify(input.term) });
  return unwrap(await db.from('glossary_terms').insert(row).select().single());
}

export async function updateTerm({ db }: AuthContext, id: string, input: z.infer<typeof S.glossaryUpdateSchema>) {
  const { data, error } = await db.from('glossary_terms').update(toGlossaryRow(input)).eq('id', id).select();
  if (error) throw error;
  if (!data?.length) throw notFound('No existe ese término');
  return data[0];
}

export async function deleteTerm({ db }: AuthContext, id: string) {
  const { error, count } = await db.from('glossary_terms').delete({ count: 'exact' }).eq('id', id);
  if (error) throw error;
  if (!count) throw notFound('No existe ese término');
  return { deleted: true };
}

// ---------------------------------------------------------------- Lexis
const TOPIC_COLUMNS =
  'id, name, keywords, suggested_question, module_id, created_at, ' +
  'answers:lexis_answers(id, body, expression, legal_reference_id, glossary_term_id, is_active, version, updated_at)';

export async function listTopics({ db }: AuthContext) {
  return unwrap(await db.from('lexis_topics').select(TOPIC_COLUMNS).order('name'));
}

export async function createTopic(ctx: AuthContext, input: z.infer<typeof S.topicCreateSchema>) {
  const topic = unwrap(
    await ctx.db
      .from('lexis_topics')
      .insert({
        name: input.name,
        keywords: input.keywords,
        suggested_question: input.suggestedQuestion ?? null,
        module_id: input.moduleId ?? null,
      })
      .select('id')
      .single(),
  ) as { id: string };
  if (input.answer) await publishAnswer(ctx, topic.id, input.answer);
  return unwrap(await ctx.db.from('lexis_topics').select(TOPIC_COLUMNS).eq('id', topic.id).single());
}

export async function updateTopic({ db }: AuthContext, id: string, input: z.infer<typeof S.topicUpdateSchema>) {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.keywords !== undefined) patch.keywords = input.keywords;
  if (input.suggestedQuestion !== undefined) patch.suggested_question = input.suggestedQuestion;
  if (input.moduleId !== undefined) patch.module_id = input.moduleId;
  const { data, error } = await db.from('lexis_topics').update(patch).eq('id', id).select(TOPIC_COLUMNS);
  if (error) throw error;
  if (!data?.length) throw notFound('No existe ese tema');
  return data[0];
}

export async function deleteTopic({ db }: AuthContext, id: string) {
  const { error, count } = await db.from('lexis_topics').delete({ count: 'exact' }).eq('id', id);
  if (error) throw error;
  if (!count) throw notFound('No existe ese tema');
  return { deleted: true };
}

/** Publica una nueva versión de la respuesta: la anterior queda inactiva (historial). */
export async function publishAnswer({ db }: AuthContext, topicId: string, input: z.infer<typeof S.answerSchema>) {
  const previous = unwrap(
    await db.from('lexis_answers').select('id, version').eq('topic_id', topicId).order('version', { ascending: false }),
  ) as { id: string; version: number }[];
  const deactivate = await db.from('lexis_answers').update({ is_active: false }).eq('topic_id', topicId).eq('is_active', true);
  if (deactivate.error) throw deactivate.error;
  return unwrap(
    await db
      .from('lexis_answers')
      .insert({
        topic_id: topicId,
        body: input.body,
        expression: input.expression,
        legal_reference_id: input.legalReferenceId ?? null,
        glossary_term_id: input.glossaryTermId ?? null,
        version: (previous[0]?.version ?? 0) + 1,
        is_active: true,
      })
      .select()
      .single(),
  );
}

export async function unanswered({ db }: AuthContext, limit: number) {
  return unwrap(await db.rpc('admin_lexis_unanswered', { p_limit: limit }));
}

// ---------------------------------------------------------------- Documentos legales
export async function createLegalDocument({ db }: AuthContext, input: z.infer<typeof S.legalDocumentSchema>) {
  return unwrap(
    await db
      .from('legal_documents')
      .insert({
        type: input.type,
        version: input.version,
        title: input.title,
        content_url: input.contentUrl,
        effective_at: input.effectiveAt,
      })
      .select()
      .single(),
  );
}

// ---------------------------------------------------------------- Bitácora
export async function listAudit({ db }: AuthContext, q: z.infer<typeof S.auditQuery>) {
  const { from, to } = pageRange(q);
  let query = db.from('audit_log').select('id, actor_id, action, table_name, record_id, changes, created_at', {
    count: 'exact',
  });
  if (q.table) query = query.eq('table_name', q.table);
  if (q.action) query = query.eq('action', q.action);
  if (q.actorId) query = query.eq('actor_id', q.actorId);
  if (q.recordId) query = query.eq('record_id', q.recordId);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;

  return paged(data, count, q);
}
