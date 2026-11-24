import { beforeAll, describe, expect, it } from 'vitest';
import { adult, api, login, RUN } from './helpers';

describe('administración', () => {
  let admin = '';
  let student = '';
  const target = adult('adm');
  let targetId = '';
  let adminId = '';

  beforeAll(async () => {
    admin = await login('admin@lexcode-demo.edu');
    student = await login('ian@lexcode-demo.edu');
    const r = await api('POST', '/auth/register', { body: target });
    targetId = r.body.data.userId;
    adminId = (await api('GET', '/auth/me', { token: admin })).body.data.id;
  });

  it('un estudiante o docente no entra a /admin', async () => {
    expect((await api('GET', '/admin/users', { token: student })).status).toBe(403);
    const teacher = await login('docente@lexcode-demo.edu');
    expect((await api('GET', '/admin/audit', { token: teacher })).status).toBe(403);
  });

  describe('usuarios', () => {
    it('lista con filtros y búsqueda', async () => {
      const all = await api('GET', '/admin/users?pageSize=100', { token: admin });
      expect(all.body.data.total).toBeGreaterThanOrEqual(9);
      const teachers = await api('GET', '/admin/users?role=teacher', { token: admin });
      expect(teachers.body.data.items.every((u: any) => u.role === 'teacher')).toBe(true);
      const found = await api('GET', `/admin/users?q=${target.username}`, { token: admin });
      expect(found.body.data.items[0].id).toBe(targetId);
      const weird = await api('GET', '/admin/users?q=a,b)(c', { token: admin });
      expect(weird.status).toBe(200);
    });

    it('detalle con consentimientos', async () => {
      const r = await api('GET', `/admin/users/${targetId}`, { token: admin });
      expect(r.body.data.consents.length).toBeGreaterThanOrEqual(2);
      expect(r.body.data).not.toHaveProperty('birth_date');
    });

    it('asigna rol docente y lo revierte', async () => {
      const r = await api('PATCH', `/admin/users/${targetId}/role`, { token: admin, body: { role: 'teacher' } });
      expect(r.status).toBe(200);
      const t = await login(target.email, target.password);
      expect((await api('GET', '/auth/me', { token: t })).body.data.role).toBe('teacher');
      await api('PATCH', `/admin/users/${targetId}/role`, { token: admin, body: { role: 'student' } });
    });

    it('no puede cambiar su propio rol', async () => {
      const r = await api('PATCH', `/admin/users/${adminId}/role`, { token: admin, body: { role: 'student' } });
      expect(r.status).toBe(422);
    });

    it('suspender bloquea el login; reactivar lo devuelve', async () => {
      const s = await api('PATCH', `/admin/users/${targetId}/status`, { token: admin, body: { status: 'suspended' } });
      expect(s.status).toBe(200);
      const blocked = await api('POST', '/auth/login', { body: { email: target.email, password: target.password } });
      expect(blocked.status).toBe(403);
      await api('PATCH', `/admin/users/${targetId}/status`, { token: admin, body: { status: 'active' } });
      await login(target.email, target.password);
    });

    it('ids inválidos: 400', async () => {
      expect((await api('GET', '/admin/users/123', { token: admin })).status).toBe(400);
    });
  });

  describe('ARCO', () => {
    it('lista por fecha límite y responde una solicitud', async () => {
      const t = await login(target.email, target.password);
      const req = await api('POST', '/privacy/arco', {
        token: t,
        body: { right: 'rectification', description: 'Mi nombre está mal escrito en el perfil.' },
      });
      const list = await api('GET', '/admin/arco?status=received', { token: admin });
      expect(list.body.data.items.some((a: any) => a.id === req.body.data.id)).toBe(true);
      const noResponse = await api('PATCH', `/admin/arco/${req.body.data.id}`, { token: admin, body: { status: 'resolved' } });
      expect(noResponse.status).toBe(400);
      const ok = await api('PATCH', `/admin/arco/${req.body.data.id}`, {
        token: admin,
        body: { status: 'resolved', response: 'Corregimos tu nombre. Gracias por avisarnos.' },
      });
      expect(ok.body.data).toMatchObject({ status: 'resolved' });
      expect(ok.body.data.responded_at).toBeTruthy();
      const mine = await api('GET', '/privacy/arco', { token: t });
      expect(mine.body.data[0].response).toMatch(/Corregimos/);
    });
  });

  describe('glosario', () => {
    let id = '';
    it('crea (slug automático), edita y borra', async () => {
      const c = await api('POST', '/admin/glossary', {
        token: admin,
        body: {
          term: `Cifrado Asimétrico ${RUN}`,
          category: 'CONCEPTO - CIBERSEGURIDAD',
          definition: 'Método de cifrado que usa un par de llaves: pública y privada.',
          legalCitation: 'NIST SP 800-57',
        },
      });
      expect(c.status).toBe(201);
      expect(c.body.data.slug).toBe(`cifrado-asimetrico-${RUN}`);
      expect(c.body.data.letter).toBe('C');
      id = c.body.data.id;
      const found = await api('GET', `/glossary?q=cifrado%20asimetrico%20${RUN}`, { token: student });
      expect(found.body.data.items[0].id).toBe(id);
      const u = await api('PATCH', `/admin/glossary/${id}`, { token: admin, body: { lexisTip: 'Nunca compartas tu llave privada.' } });
      expect(u.body.data.lexis_tip).toMatch(/llave privada/);
      expect((await api('DELETE', `/admin/glossary/${id}`, { token: admin })).status).toBe(200);
      expect((await api('DELETE', `/admin/glossary/${id}`, { token: admin })).status).toBe(404);
    });

    it('un estudiante no puede crear términos', async () => {
      const r = await api('POST', '/admin/glossary', {
        token: student,
        body: { term: 'X', category: 'Y', definition: 'zzzzzzzzzzzz', legalCitation: 'abc' },
      });
      expect(r.status).toBe(403);
    });
  });

  describe('Lexis', () => {
    it('crea un tema con respuesta y Lexis lo usa; publica una nueva versión', async () => {
      const name = `Ransomware ${RUN}`;
      const c = await api('POST', '/admin/lexis/topics', {
        token: admin,
        body: {
          name,
          keywords: [`ransomware${RUN}`, 'secuestro de datos'],
          suggestedQuestion: '¿Qué es el ransomware?',
          answer: { body: 'El ransomware cifra tus archivos y pide un rescate. Ten respaldos.', expression: 'angry' },
        },
      });
      expect(c.status).toBe(201);
      const topicId = c.body.data.id;
      const ask = await api('POST', '/lexis/ask', { token: student, body: { text: `ransomware${RUN}` } });
      expect(ask.body.data).toMatchObject({ found: true, expression: 'angry' });

      const v2 = await api('POST', `/admin/lexis/topics/${topicId}/answers`, {
        token: admin,
        body: { body: 'Versión 2: el ransomware secuestra tus datos. Respáldalos y no pagues.', expression: 'neutral' },
      });
      expect(v2.body.data).toMatchObject({ version: 2, is_active: true });
      const ask2 = await api('POST', '/lexis/ask', { token: student, body: { text: `ransomware${RUN}` } });
      expect(ask2.body.data.body).toMatch(/Versión 2/);

      const topics = await api('GET', '/admin/lexis/topics', { token: admin });
      const t = topics.body.data.find((x: any) => x.id === topicId);
      expect(t.answers).toHaveLength(2);
      expect((await api('DELETE', `/admin/lexis/topics/${topicId}`, { token: admin })).status).toBe(200);
    });

    it('preguntas sin respuesta (agregadas, sin autor)', async () => {
      await api('POST', '/lexis/ask', { token: student, body: { text: `pregunta rara ${RUN}` } });
      const r = await api('GET', '/admin/lexis/unanswered', { token: admin });
      const row = r.body.data.find((q: any) => q.question.includes(RUN));
      expect(row).toBeTruthy();
      expect(row).not.toHaveProperty('user_id');
    });
  });

  describe('reportes, documentos y bitácora', () => {
    it('atiende un reporte', async () => {
      // Los reportes los crea el estudiante directamente (módulo de grupos).
      const list = await api('GET', '/admin/reports', { token: admin });
      expect(list.status).toBe(200);
      const missing = await api('PATCH', '/admin/reports/00000000-0000-4000-8000-000000000000', {
        token: admin,
        body: { status: 'resolved' },
      });
      expect(missing.status).toBe(404);
    });

    it('publica un documento legal futuro sin cambiar el vigente', async () => {
      const r = await api('POST', '/admin/legal-documents', {
        token: admin,
        body: {
          type: 'terms',
          version: `9.${Number.parseInt(RUN, 36) % 900}`,
          title: 'Términos y Condiciones (borrador)',
          contentUrl: 'https://lexcode.app/legal/terminos-9.pdf',
          effectiveAt: '2099-01-01',
        },
      });
      expect(r.status).toBe(201);
      const docs = await api('GET', '/privacy/documents');
      expect(docs.body.data.current.terms.version).toBe('1.0');
    });

    it('la bitácora registra al admin como autor del cambio de rol', async () => {
      const r = await api('GET', `/admin/audit?table=profiles&recordId=${targetId}&action=UPDATE`, { token: admin });
      expect(r.status).toBe(200);
      const roleChange = r.body.data.items.find((e: any) => e.changes && 'role' in e.changes);
      expect(roleChange?.actor_id).toBe(adminId);
    });
  });
});
