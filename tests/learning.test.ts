import { beforeAll, describe, expect, it } from 'vitest';
import { adult, api, login, RUN } from './helpers';


const MODULE_2 = '10000000-0000-4000-8000-000000000002'; 
const MODULE_3 = '10000000-0000-4000-8000-000000000003'; 
const MODULE_4 = '10000000-0000-4000-8000-000000000004'; 
const QUIZ_LEGISLATION = '30000000-0000-4000-8000-000000000002';
const DILEMMA_1 = '20000000-0000-4000-8000-000000000001';
const DILEMMA_2 = '20000000-0000-4000-8000-000000000002';
const GROUP_7B_CODE = 'TIID7B26';

const DOCENTE = 'docente@lexcode-demo.edu';
const ADMIN = 'admin@lexcode-demo.edu';

describe('aprendizaje y aula (persona B)', () => {
  const student = adult('lrn');
  let stu = '';
  let teacher = '';
  let admin = '';

  beforeAll(async () => {
    expect((await api('POST', '/auth/register', { body: student })).status).toBe(201);
    stu = await login(student.email, student.password);
    teacher = await login(DOCENTE);
    admin = await login(ADMIN);
  });

  describe('contenido', () => {
    it('lista rutas con el estado de cada módulo', async () => {
      const r = await api('GET', '/paths', { token: stu });
      expect(r.status).toBe(200);
      expect(r.body.data.length).toBeGreaterThanOrEqual(3);
      const legislation = r.body.data.find((p: any) => p.slug === 'legislacion-ti');
      const byId = Object.fromEntries(legislation.modules.map((m: any) => [m.id, m]));
      expect(byId[MODULE_2]).toMatchObject({ unlocked: true, status: 'available' });
      expect(byId[MODULE_3]).toMatchObject({ unlocked: false, status: 'locked' });
    });

    it('no entrega el contenido de un módulo bloqueado', async () => {
      const r = await api('GET', `/modules/${MODULE_3}`, { token: stu });
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('module_locked');
      expect((await api('GET', `/modules/${MODULE_2}`, { token: stu })).status).toBe(200);
    });

    it('requiere sesión', async () => {
      expect((await api('GET', '/paths')).status).toBe(401);
    });

    it('los dilemas llegan con estado y sin revelar la opción esperada', async () => {
      const list = await api('GET', '/dilemmas', { token: stu });
      expect(list.status).toBe(200);
      const byId = Object.fromEntries(list.body.data.map((d: any) => [d.id, d]));
      expect(byId[DILEMMA_1].status).toBe('active');
      expect(byId[DILEMMA_2].status).toBe('locked');

      const one = await api('GET', `/dilemmas/${DILEMMA_1}`, { token: stu });
      expect(one.status).toBe(200);
      expect(one.body.data.options.length).toBeGreaterThanOrEqual(2);
      expect(JSON.stringify(one.body.data)).not.toMatch(/is_expected|xp_delta|feedback/);
    });

    it('los quizzes llegan sin la respuesta correcta', async () => {
      const r = await api('GET', `/quizzes/${QUIZ_LEGISLATION}`, { token: stu });
      expect(r.status).toBe(200);
      expect(r.body.data.questions.length).toBeGreaterThan(0);
      expect(JSON.stringify(r.body.data)).not.toMatch(/is_correct/);
    });
  });

  describe('motor de evaluación', () => {
    it('quiz completo: iniciar, responder, retomar y cerrar', async () => {
      const quiz = (await api('GET', `/quizzes/${QUIZ_LEGISLATION}`, { token: stu })).body.data;
      const start = await api('POST', '/attempts', { token: stu, body: { activity: 'quiz', targetId: QUIZ_LEGISLATION } });
      expect(start.status).toBe(201);
      const attemptId = start.body.data.attempt.id;
      expect(start.body.data.total).toBe(quiz.questions.length);

      const first = quiz.questions[0];
      const a1 = await api('POST', `/attempts/${attemptId}/answers`, {
        token: stu,
        body: { questionId: first.id, optionId: first.options[0].id, timeMs: 4000 },
      });
      expect(a1.status).toBe(201);
      expect(a1.body.data).toHaveProperty('isCorrect');
      expect(a1.body.data).toHaveProperty('explanation');

      
      const dup = await api('POST', `/attempts/${attemptId}/answers`, {
        token: stu,
        body: { questionId: first.id, optionId: first.options[0].id, timeMs: 4000 },
      });
      expect(dup.status).toBe(422);

      
      const resumed = await api('POST', '/attempts', { token: stu, body: { activity: 'quiz', targetId: QUIZ_LEGISLATION } });
      expect(resumed.body.data.attempt.id).toBe(attemptId);
      expect(resumed.body.data.resumed).toBe(true);
      expect(resumed.body.data.answered).toHaveLength(1);

      for (const q of quiz.questions.slice(1)) {
        const r = await api('POST', `/attempts/${attemptId}/answers`, {
          token: stu,
          body: { questionId: q.id, optionId: q.options[0].id, timeMs: 3000 },
        });
        expect(r.status).toBe(201);
      }
      const done = await api('POST', `/attempts/${attemptId}/finish`, { token: stu });
      expect(done.status).toBe(200);
      expect(done.body.data).toMatchObject({ total: quiz.questions.length });
      expect(done.body.data.score).toBeGreaterThanOrEqual(0);

      
      const late = await api('POST', `/attempts/${attemptId}/answers`, {
        token: stu,
        body: { questionId: first.id, optionId: first.options[0].id, timeMs: 1000 },
      });
      expect(late.status).toBe(422);
    });

    it('dilema: responde, recibe retroalimentación y avanza el desbloqueo', async () => {
      const start = await api('POST', '/attempts', { token: stu, body: { activity: 'dilemma', targetId: DILEMMA_1 } });
      expect(start.status).toBe(201);
      const id = start.body.data.attempt.id;
      const detail = (await api('GET', `/dilemmas/${DILEMMA_1}`, { token: stu })).body.data;
      const ans = await api('POST', `/attempts/${id}/answers`, {
        token: stu,
        body: { optionId: detail.options[0].id, justification: 'Porque la ley exige el consentimiento.', timeMs: 20000 },
      });
      expect(ans.status).toBe(201);
      expect(ans.body.data).toHaveProperty('feedbackTitle');
      expect((await api('POST', `/attempts/${id}/finish`, { token: stu })).status).toBe(200);

      const list = await api('GET', '/dilemmas', { token: stu });
      expect(list.body.data.find((d: any) => d.id === DILEMMA_2).status).toBe('active');
    });

    it('rechaza peticiones mal formadas o prohibidas', async () => {
      expect((await api('POST', '/attempts', { token: stu, body: { activity: 'quiz', targetId: 'no-es-uuid' } })).status).toBe(400);
      expect((await api('POST', '/attempts', { token: stu, body: { activity: 'ajedrez', targetId: QUIZ_LEGISLATION } })).status).toBe(400);
      
      const locked = await api('POST', '/attempts', { token: stu, body: { activity: 'fill_blank', targetId: MODULE_3 } });
      expect(locked.status).toBe(422);
      
      expect((await api('POST', '/attempts', { token: teacher, body: { activity: 'quiz', targetId: QUIZ_LEGISLATION } })).status).toBe(403);
    });
  });

  describe('actividades del centro de entrenamiento', () => {
    it('memorama: dos columnas mezcladas, con los mismos ids', async () => {
      const r = await api('GET', `/activities/memory-match/${MODULE_4}`, { token: stu });
      expect(r.status).toBe(200);
      expect(r.body.data.concepts).toHaveLength(4);
      expect(r.body.data.definitions.map((d: any) => d.id).sort()).toEqual(r.body.data.concepts.map((c: any) => c.id).sort());
    });

    it('código incompleto: no incluye la respuesta correcta', async () => {
      const r = await api('GET', `/activities/fill-blank/${MODULE_3}`, { token: stu });
      expect(r.status).toBe(200);
      expect(r.body.data.items.length).toBeGreaterThan(0);
      expect(r.body.data.items[0]).not.toHaveProperty('answer');
    });

    it('un módulo de otro tipo se rechaza', async () => {
      expect((await api('GET', `/activities/fill-blank/${MODULE_4}`, { token: stu })).status).toBe(422);
    });
  });

  describe('progreso y gamificación', () => {
    it('el progreso refleja el módulo trabajado', async () => {
      const r = await api('GET', '/progress', { token: stu });
      expect(r.status).toBe(200);
      const legislation = r.body.data.find((p: any) => p.slug === 'legislacion-ti');
      expect(legislation.modules.find((m: any) => m.id === MODULE_2).percent).toBeGreaterThanOrEqual(0);
      expect(legislation).toHaveProperty('pathCompleted', false);
    });

    it('insignias con su requisito y resumen de XP', async () => {
      const b = await api('GET', '/badges', { token: stu });
      expect(b.status).toBe(200);
      expect(b.body.data.items[0]).toHaveProperty('requirement');
      const s = await api('GET', '/gamification/summary', { token: stu });
      expect(s.status).toBe(200);
      expect(s.body.data.xp.total).toBeGreaterThanOrEqual(0);
      expect(s.body.data.streak.current).toBeGreaterThanOrEqual(1);
    });

    it('ranking público y recordatorios (apagados sin consentimiento)', async () => {
      expect((await api('GET', '/rankings/public', { token: stu })).status).toBe(200);
      const r = await api('GET', '/reminders', { token: stu });
      expect(r.body.data).toMatchObject({ enabled: false, reminders: [] });
    });

    it('dashboard del estudiante', async () => {
      const r = await api('GET', '/dashboard/student', { token: stu });
      expect(r.status).toBe(200);
      expect(r.body.data).toHaveProperty('xp');
      expect(r.body.data).toHaveProperty('recentActivity');
      expect((await api('GET', '/dashboard/student', { token: teacher })).status).toBe(403);
    });
  });

  describe('grupos y quizzes del docente', () => {
    let groupId = '';
    let inviteCode = '';
    let quizId = '';

    it('el docente crea un grupo con código de 8 caracteres', async () => {
      const r = await api('POST', '/groups', { token: teacher, body: { name: `Grupo prueba ${RUN}`, subject: 'Ética', term: '2026-3' } });
      expect(r.status).toBe(201);
      expect(r.body.data.invite_code).toMatch(/^[A-Z0-9]{8}$/);
      groupId = r.body.data.id;
      inviteCode = r.body.data.invite_code;
    });

    it('un estudiante no crea grupos', async () => {
      expect((await api('POST', '/groups', { token: stu, body: { name: 'Mi grupo' } })).status).toBe(403);
    });

    it('el estudiante se une, no ve el código y puede salir', async () => {
      const join = await api('POST', '/groups/join', { token: stu, body: { inviteCode: inviteCode.toLowerCase() } });
      expect(join.status).toBe(200);
      const mine = await api('GET', '/groups', { token: stu });
      const g = mine.body.data.find((x: any) => x.id === groupId);
      expect(g).toBeTruthy();
      expect(g).not.toHaveProperty('invite_code');

      const detail = await api('GET', `/groups/${groupId}`, { token: teacher });
      expect(detail.body.data.students.length).toBe(1);

      expect((await api('POST', '/groups/join', { token: stu, body: { inviteCode: 'ZZZZZZZZ' } })).status).toBe(404);
    });

    it('el docente crea un quiz del grupo y el estudiante lo ve sin respuestas', async () => {
      const body = {
        groupId,
        title: `Quiz de grupo ${RUN}`,
        timeLimitSeconds: 45,
        isPublished: true,
        questions: [
          {
            prompt: '¿Qué ley protege los datos personales en posesión de particulares?',
            explanation: 'La LFPDPPP regula el tratamiento de datos personales por particulares.',
            options: [
              { label: 'A', body: 'LFPDPPP', isCorrect: true },
              { label: 'B', body: 'LFDA', isCorrect: false },
            ],
          },
        ],
      };
      const r = await api('POST', '/quizzes', { token: teacher, body });
      expect(r.status).toBe(201);
      quizId = r.body.data.id;
      expect(JSON.stringify(r.body.data)).toMatch(/is_correct/); 

      const asStudent = await api('GET', `/quizzes/${quizId}`, { token: stu });
      expect(asStudent.status).toBe(200);
      expect(JSON.stringify(asStudent.body.data)).not.toMatch(/is_correct/);
      expect((await api('GET', `/quizzes/${quizId}/edit`, { token: stu })).status).toBe(403);
    });

    it('valida que cada pregunta tenga exactamente una opción correcta', async () => {
      const bad = await api('POST', '/quizzes', {
        token: teacher,
        body: {
          groupId,
          title: 'Quiz inválido',
          questions: [
            {
              prompt: '¿Pregunta sin respuesta correcta?',
              explanation: 'No debería aceptarse.',
              options: [
                { label: 'A', body: 'Uno', isCorrect: false },
                { label: 'B', body: 'Dos', isCorrect: false },
              ],
            },
          ],
        },
      });
      expect(bad.status).toBe(400);
    });

    it('un docente no crea quizzes oficiales', async () => {
      const r = await api('POST', '/quizzes', {
        token: teacher,
        body: {
          moduleId: MODULE_2,
          title: 'Quiz oficial falso',
          questions: [
            {
              prompt: '¿Esto debería rechazarse?',
              explanation: 'Solo un administrador crea quizzes oficiales.',
              options: [
                { label: 'A', body: 'Sí', isCorrect: true },
                { label: 'B', body: 'No', isCorrect: false },
              ],
            },
          ],
        },
      });
      expect(r.status).toBe(403);
    });

    it('comentarios del docente al alumno', async () => {
      const me = (await api('GET', '/profile', { token: stu })).body.data;
      const r = await api('POST', `/groups/${groupId}/comments`, { token: teacher, body: { studentId: me.id, body: 'Buen avance, sigue así.' } });
      expect(r.status).toBe(201);
      const mine = await api('GET', '/comments', { token: stu });
      expect(mine.body.data.items[0].body).toBe('Buen avance, sigue así.');
    });

    it('dashboard del docente con estadísticas anonimizadas', async () => {
      const d = await api('GET', `/dashboard/teacher?groupId=${groupId}`, { token: teacher });
      expect(d.status).toBe(200);
      expect(d.body.data).toMatchObject({ studentCount: 1 });
      expect(d.body.data).toHaveProperty('groupAverage');
      const stats = await api('GET', `/dashboard/stats/questions?quizId=${quizId}`, { token: teacher });
      expect(stats.status).toBe(200);
      expect((await api('GET', `/dashboard/stats/questions?quizId=${quizId}`, { token: stu })).status).toBe(403);
    });

    it('sale del grupo y el docente lo cierra', async () => {
      expect((await api('DELETE', `/groups/${groupId}/members/me`, { token: stu })).status).toBe(200);
      expect((await api('DELETE', `/groups/${groupId}/members/me`, { token: stu })).status).toBe(404);
      const closed = await api('PATCH', `/groups/${groupId}`, { token: teacher, body: { isActive: false } });
      expect(closed.body.data.is_active).toBe(false);
      expect((await api('POST', '/groups/join', { token: stu, body: { inviteCode } })).status).toBe(404);
    });

    it('unirse con un código de seed también funciona', async () => {
      expect((await api('POST', '/groups/join', { token: stu, body: { inviteCode: GROUP_7B_CODE } })).status).toBe(200);
    });
  });

  describe('administración', () => {
    it('solo un admin administra el contenido', async () => {
      expect((await api('POST', '/admin/paths', { token: teacher, body: {} })).status).toBe(403);
      expect((await api('GET', '/admin/cheats', { token: stu })).status).toBe(403);
    });

    it('crea, publica y borra una ruta con un módulo', async () => {
      const slug = `ruta-prueba-${RUN}`;
      const path = await api('POST', '/admin/paths', {
        token: admin,
        body: { slug, title: 'Ruta de prueba', area: 'ethics', sortOrder: 90 },
      });
      expect(path.status).toBe(201);
      const pathId = path.body.data.id;
      expect(path.body.data.is_published).toBe(false);

      const mod = await api('POST', '/admin/modules', {
        token: admin,
        body: { pathId, title: 'Módulo de prueba', sortOrder: 1, content: { blocks: [{ type: 'text', body: 'Hola' }] } },
      });
      expect(mod.status).toBe(201);

      const published = await api('PATCH', `/admin/paths/${pathId}`, { token: admin, body: { isPublished: true } });
      expect(published.body.data.is_published).toBe(true);
      
      expect(published.body.data.title).toBe('Ruta de prueba');

      expect((await api('DELETE', `/admin/paths/${pathId}`, { token: admin })).status).toBe(200);
    });

    it('un dilema necesita exactamente una opción esperada', async () => {
      const option = (label: string, expected: boolean) => ({
        label,
        body: `Opción ${label}`,
        isExpected: expected,
        xpDelta: expected ? 100 : -50,
        feedbackTitle: 'Retroalimentación',
        feedbackText: 'Texto de retroalimentación suficiente.',
      });
      const base = {
        number: 400 + Math.floor(Math.random() * 90), 
        title: 'Dilema de prueba',
        category: 'DILEMA DE PRUEBA',
        scenario: 'Escenario de prueba lo bastante largo para validar.',
        lawQuote: 'Artículo de prueba',
      };
      const twoExpected = await api('POST', '/admin/dilemmas', {
        token: admin,
        body: { ...base, options: [option('A', true), option('B', true)] },
      });
      expect(twoExpected.status).toBe(400);
      expect(JSON.stringify(twoExpected.body)).toMatch(/esperada/); 

      const ok = await api('POST', '/admin/dilemmas', {
        token: admin,
        body: { ...base, isPublished: false, options: [option('A', true), option('B', false), option('C', false)] },
      });
      expect(ok.status).toBe(201);
      expect(ok.body.data.options.find((o: any) => o.is_expected).label).toBe('A');

      
      const swapped = await api('PATCH', `/admin/dilemmas/${ok.body.data.id}`, {
        token: admin,
        body: { options: [option('A', false), option('B', true), option('C', false)] },
      });
      expect(swapped.status).toBe(200);
      expect(swapped.body.data.options.find((o: any) => o.is_expected).label).toBe('B');
      expect((await api('DELETE', `/admin/dilemmas/${ok.body.data.id}`, { token: admin })).status).toBe(200);
    });

    it('cola de revisión de trampas y estadísticas por ruta', async () => {
      const cheats = await api('GET', '/admin/cheats', { token: admin });
      expect(cheats.status).toBe(200);
      expect(Array.isArray(cheats.body.data)).toBe(true);
      expect((await api('GET', '/dashboard/stats/paths', { token: admin })).status).toBe(200);
    });
  });

  describe('constancias', () => {
    it('la verificación pública no requiere sesión', async () => {
      expect((await api('GET', '/certificates/verify/no-es-un-folio')).status).toBe(400);
      expect((await api('GET', '/certificates/verify/LX-ZZZZZZZZZ')).status).toBe(404);
    });

    it('lista las constancias propias (vacío al inicio)', async () => {
      const r = await api('GET', '/certificates', { token: stu });
      expect(r.status).toBe(200);
      expect(r.body.data).toEqual([]);
    });
  });
});
