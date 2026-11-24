import { beforeAll, describe, expect, it } from 'vitest';
import { adult, api, login } from './helpers';

describe('perfil, privacidad, Lexis y glosario (estudiante)', () => {
  const user = adult('stu');
  let token = '';

  beforeAll(async () => {
    expect((await api('POST', '/auth/register', { body: user })).status).toBe(201);
    token = await login(user.email, user.password);
  });

  describe('perfil', () => {
    it('lee su perfil sin fecha de nacimiento', async () => {
      const r = await api('GET', '/profile', { token });
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ username: user.username, role: 'student', xp_total: 0 });
      expect(r.body.data).not.toHaveProperty('birth_date');
    });

    it('edita campos permitidos', async () => {
      const r = await api('PATCH', '/profile', {
        token,
        body: { major: 'Ingeniería en Software', semester: 7, interestArea: 'cybersecurity', untimedMode: true },
      });
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ major: 'Ingeniería en Software', semester: 7, untimed_mode: true });
    });

    it('rechaza valores inválidos y usuarios ocupados', async () => {
      expect((await api('PATCH', '/profile', { token, body: { semester: 20 } })).status).toBe(400);
      expect((await api('PATCH', '/profile', { token, body: {} })).status).toBe(400);
      const taken = await api('PATCH', '/profile', { token, body: { username: 'regina_calderon' } });
      expect(taken.status).toBe(409);
    });

    it('no acepta campos que no existen (rol, XP)', async () => {
      const r = await api('PATCH', '/profile', { token, body: { role: 'admin', xp_total: 9999, major: 'ISC' } });
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ role: 'student', xp_total: 0, major: 'ISC' });
    });

    it('avatar: valida tipo de archivo', async () => {
      const form = new FormData();
      form.append('avatar', new Blob(['hola'], { type: 'text/plain' }), 'nota.txt');
      const r = await api('POST', '/profile/avatar', { token, form });
      expect(r.status).toBe(400);
      expect((await api('POST', '/profile/avatar', { token, form: new FormData() })).status).toBe(400);
    });
  });

  describe('privacidad', () => {
    it('documentos legales son públicos', async () => {
      const r = await api('GET', '/privacy/documents');
      expect(r.status).toBe(200);
      expect(r.body.data.current.privacyNotice.version).toBe('5.0');
      expect(r.body.data.current.terms.version).toBe('1.0');
    });

    it('retira y otorga el consentimiento de rankings públicos', async () => {
      const off = await api('POST', '/privacy/consents', { token, body: { type: 'public_rankings', granted: false } });
      expect(off.status).toBe(201);
      expect((await api('GET', '/profile', { token })).body.data.public_ranking).toBe(false);
      await api('POST', '/privacy/consents', { token, body: { type: 'public_rankings', granted: true } });
      expect((await api('GET', '/profile', { token })).body.data.public_ranking).toBe(true);
    });

    it('no se puede "retirar" el aviso de privacidad', async () => {
      const r = await api('POST', '/privacy/consents', { token, body: { type: 'privacy_notice', granted: false } });
      expect(r.status).toBe(422);
    });

    it('solicitud ARCO con folio y fecha límite', async () => {
      const r = await api('POST', '/privacy/arco', {
        token,
        body: { right: 'access', description: 'Quiero saber qué datos personales tienen de mí.' },
      });
      expect(r.status).toBe(201);
      expect(r.body.data.folio).toMatch(/^ARCO-\d{4}-[A-Z0-9]{5}$/);
      expect(r.body.data.due_date).toBeTruthy();
      const list = await api('GET', '/privacy/arco', { token });
      expect(list.body.data).toHaveLength(1);
      expect((await api('POST', '/privacy/arco', { token, body: { right: 'access', description: 'corta' } })).status).toBe(400);
    });

    it('exporta sus datos como archivo JSON', async () => {
      const r = await api('GET', '/privacy/export', { token });
      expect(r.status).toBe(200);
      expect(r.headers.get('content-disposition')).toMatch(/attachment; filename="lexcode-mis-datos-/);
      expect(r.body).toHaveProperty('profile');
    });

    it('elimina la cuenta, queda bloqueada y la recupera', async () => {
      const other = adult('del');
      await api('POST', '/auth/register', { body: other });
      const t = await login(other.email, other.password);
      const del = await api('DELETE', '/privacy/account', { token: t });
      expect(del.status).toBe(200);
      expect(del.body.data.purgeAt).toBeTruthy();
      expect((await api('GET', '/profile', { token: t })).body.error.code).toBe('account_deleted');
      expect((await api('GET', '/auth/me', { token: t })).body.data.status).toBe('deleted');
      expect((await api('GET', '/privacy/export', { token: t })).status).toBe(200);
      expect((await api('POST', '/privacy/account/restore', { token: t })).status).toBe(200);
      expect((await api('GET', '/profile', { token: t })).status).toBe(200);
    });
  });

  describe('Lexis', () => {
    it('responde preguntas conocidas y guarda historial', async () => {
      const r = await api('POST', '/lexis/ask', { token, body: { text: '¿Qué es el phishing?' } });
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ found: true });
      expect(r.body.data.body).toMatch(/phishing/i);
      const fb = await api('POST', `/lexis/messages/${r.body.data.messageId}/feedback`, { token, body: { helpful: true } });
      expect(fb.body.data.was_helpful).toBe(true);
    });

    it('fuera de tema: sugerencias', async () => {
      const r = await api('POST', '/lexis/ask', { token, body: { text: 'receta de pastel' } });
      expect(r.body.data.found).toBe(false);
      expect(r.body.data.suggestions.length).toBeGreaterThan(0);
    });

    it('limpia HTML y valida longitud', async () => {
      expect((await api('POST', '/lexis/ask', { token, body: { text: ' ' } })).status).toBe(400);
      expect((await api('POST', '/lexis/ask', { token, body: { text: 'x'.repeat(501) } })).status).toBe(400);
    });

    it('no puede calificar mensajes ajenos', async () => {
      const regina = await login('regina@lexcode-demo.edu');
      const mine = await api('POST', '/lexis/ask', { token: regina, body: { text: 'derechos arco' } });
      const r = await api('POST', `/lexis/messages/${mine.body.data.messageId}/feedback`, { token, body: { helpful: false } });
      expect(r.status).toBe(404);
    });

    it('sugerencias, historial y borrado', async () => {
      const s = await api('GET', '/lexis/suggestions', { token });
      expect(s.body.data.length).toBeGreaterThan(0);
      const h = await api('GET', '/lexis/history?pageSize=1', { token });
      expect(h.body.data.total).toBeGreaterThanOrEqual(2);
      expect(h.body.data.items).toHaveLength(1);
      const d = await api('DELETE', '/lexis/history', { token });
      expect(d.body.data.deleted).toBeGreaterThanOrEqual(2);
      expect((await api('GET', '/lexis/history', { token })).body.data.total).toBe(0);
    });
  });

  describe('glosario y búsqueda', () => {
    it('lista términos con índice de letras', async () => {
      const r = await api('GET', '/glossary', { token });
      expect(r.body.data.total).toBeGreaterThanOrEqual(5);
      expect(r.body.data.letters).toContain('D');
    });

    it('busca sin acentos y con errores de dedo', async () => {
      const etico = await api('GET', '/glossary?q=dilema%20etico', { token });
      expect(etico.body.data.items[0].term).toBe('DILEMA ÉTICO');
      const typo = await api('GET', '/glossary?q=sencibles', { token });
      expect(typo.body.data.items[0].term).toBe('DATOS PERSONALES SENSIBLES');
    });

    it('filtra por letra y categoría; detalle por slug', async () => {
      const cats = await api('GET', '/glossary/categories', { token });
      const cat = cats.body.data[0].name;
      const byCat = await api('GET', `/glossary?category=${encodeURIComponent(cat)}`, { token });
      expect(byCat.body.data.items.every((t: any) => t.category === cat)).toBe(true);
      const byLetter = await api('GET', '/glossary?letter=d', { token });
      expect(byLetter.body.data.items.every((t: any) => t.letter === 'D')).toBe(true);
      const slug = byLetter.body.data.items[0].slug;
      expect((await api('GET', `/glossary/${slug}`, { token })).status).toBe(200);
      expect((await api('GET', '/glossary/no-existe', { token })).status).toBe(404);
    });

    it('búsqueda general en varios tipos de contenido', async () => {
      const r = await api('GET', '/search?q=licencia', { token });
      expect(r.body.data.map((h: any) => h.kind)).toEqual(expect.arrayContaining(['dilemma', 'lexis_topic']));
      expect((await api('GET', '/search?q=a', { token })).status).toBe(400);
    });

    it('requiere sesión', async () => {
      expect((await api('GET', '/glossary')).status).toBe(401);
    });
  });
});
