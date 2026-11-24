import { beforeAll, describe, expect, it } from 'vitest';
import { adult, api, guardianToken, login, RUN } from './helpers';

describe('auth', () => {
  it('health responde', async () => {
    const r = await api('GET', '/health');
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('ok');
  });

  it('login correcto devuelve sesión y perfil', async () => {
    const r = await api('POST', '/auth/login', { body: { email: 'regina@lexcode-demo.edu', password: 'LexCode2026!' } });
    expect(r.status).toBe(200);
    expect(r.body.data.session.accessToken).toBeTruthy();
    expect(r.body.data.profile).toMatchObject({ username: 'regina_calderon', role: 'student', status: 'active' });
  });

  it('login incorrecto da 401 en español', async () => {
    const r = await api('POST', '/auth/login', { body: { email: 'regina@lexcode-demo.edu', password: 'otra' } });
    expect(r.status).toBe(401);
    expect(r.body.error).toMatchObject({ code: 'invalid_credentials', message: 'Correo o contraseña incorrectos' });
  });

  it('valida el cuerpo con mensajes por campo', async () => {
    const r = await api('POST', '/auth/login', { body: { email: 'no-es-correo' } });
    expect(r.status).toBe(400);
    expect(r.body.error.details.fields).toHaveProperty('email');
    expect(r.body.error.details.fields).toHaveProperty('password');
  });

  it('sin token: 401', async () => {
    expect((await api('GET', '/auth/me')).status).toBe(401);
    expect((await api('GET', '/auth/me', { token: 'basura' })).body.error.code).toBe('session_expired');
  });

  describe('registro', () => {
    const user = adult('reg');

    it('adulto: crea cuenta activa de estudiante', async () => {
      const r = await api('POST', '/auth/register', { body: { ...user } });
      expect(r.status).toBe(201);
      expect(r.body.data.status).toBe('active');
      const token = await login(user.email, user.password);
      const me = await api('GET', '/auth/me', { token });
      expect(me.body.data).toMatchObject({ role: 'student', status: 'active', username: user.username });
      const consents = await api('GET', '/privacy/consents', { token });
      expect(consents.body.data.map((c: any) => c.type)).toEqual(
        expect.arrayContaining(['privacy_notice', 'terms', 'secondary_purposes']),
      );
    });

    it('usuario repetido: 409 username_taken', async () => {
      const r = await api('POST', '/auth/register', { body: { ...adult('dup'), username: user.username } });
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe('username_taken');
    });

    it('correo repetido: 409', async () => {
      const r = await api('POST', '/auth/register', { body: { ...adult('dup2'), email: user.email } });
      expect(r.status).toBe(409);
    });

    it('username-available', async () => {
      const taken = await api('GET', `/auth/username-available?username=${user.username}`);
      const free = await api('GET', `/auth/username-available?username=libre_${RUN}`);
      expect(taken.body.data.available).toBe(false);
      expect(free.body.data.available).toBe(true);
    });

    it('rechaza menores de 13 y exige tutor de 13 a 17', async () => {
      const kid = await api('POST', '/auth/register', { body: { ...adult('kid'), birthDate: '2018-01-01' } });
      expect(kid.status).toBe(422);
      expect(kid.body.error.code).toBe('underage');
      const teen = await api('POST', '/auth/register', { body: { ...adult('teen0'), birthDate: '2011-01-01' } });
      expect(teen.status).toBe(400);
      expect(teen.body.error.details.fields).toHaveProperty('guardianEmail');
    });

    it('debe aceptar aviso y términos', async () => {
      const r = await api('POST', '/auth/register', { body: { ...adult('noacc'), acceptTerms: false } });
      expect(r.status).toBe(400);
      expect(r.body.error.details.fields).toHaveProperty('acceptTerms');
    });
  });

  describe('menor de edad con tutor', () => {
    const teen = { ...adult('teen'), birthDate: '2011-03-03', guardianEmail: `tutor.${RUN}@prueba.test` };
    let token = '';
    let userId = '';

    beforeAll(async () => {
      const r = await api('POST', '/auth/register', { body: teen });
      expect(r.status).toBe(201);
      expect(r.body.data.status).toBe('pending_guardian');
      userId = r.body.data.userId;
      token = await login(teen.email, teen.password);
    });

    it('queda pendiente y no puede usar la app', async () => {
      expect((await api('GET', '/auth/me', { token })).body.data.status).toBe('pending_guardian');
      const p = await api('GET', '/profile', { token });
      expect(p.status).toBe(403);
      expect(p.body.error.code).toBe('account_pending_guardian');
    });

    it('puede pedir que se reenvíe el correo al tutor', async () => {
      const r = await api('POST', '/auth/guardian/resend', { token });
      expect(r.status).toBe(200);
    });

    it('token falso o vencido: 400', async () => {
      expect((await api('POST', '/auth/guardian/confirm', { body: { token: 'x'.repeat(40) } })).status).toBe(400);
      const expired = guardianToken(userId, teen.guardianEmail, -10);
      expect((await api('POST', '/auth/guardian/confirm', { body: { token: expired } })).status).toBe(400);
    });

    it('el tutor autoriza y la cuenta se activa', async () => {
      const r = await api('POST', '/auth/guardian/confirm', { body: { token: guardianToken(userId, teen.guardianEmail) } });
      expect(r.status).toBe(200);
      expect((await api('GET', '/profile', { token })).status).toBe(200);
      const again = await api('POST', '/auth/guardian/confirm', { body: { token: guardianToken(userId, teen.guardianEmail) } });
      expect(again.status).toBe(404);
    });
  });

  describe('sesión y contraseña', () => {
    const user = adult('pwd');
    beforeAll(async () => {
      expect((await api('POST', '/auth/register', { body: user })).status).toBe(201);
    });

    it('refresh renueva y logout invalida el refresh token', async () => {
      const l = await api('POST', '/auth/login', { body: { email: user.email, password: user.password } });
      const { accessToken, refreshToken } = l.body.data.session;
      const r = await api('POST', '/auth/refresh', { body: { refreshToken } });
      expect(r.status).toBe(200);
      const fresh = r.body.data.session;
      expect((await api('POST', '/auth/logout', { token: fresh.accessToken })).status).toBe(200);
      const after = await api('POST', '/auth/refresh', { body: { refreshToken: fresh.refreshToken } });
      expect(after.status).toBe(401);
      expect(accessToken).toBeTruthy();
    });

    it('cambiar contraseña exige la actual', async () => {
      const token = await login(user.email, user.password);
      const wrong = await api('PATCH', '/profile/password', {
        token,
        body: { currentPassword: 'Incorrecta1', newPassword: 'Nueva12345' },
      });
      expect(wrong.status).toBe(400);
      expect(wrong.body.error.code).toBe('wrong_password');
      const ok = await api('PATCH', '/profile/password', {
        token,
        body: { currentPassword: user.password, newPassword: 'Nueva12345' },
      });
      expect(ok.status).toBe(200);
      await login(user.email, 'Nueva12345');
    });

    it('reset sin sesión de recuperación: 403', async () => {
      const token = await login(user.email, 'Nueva12345');
      const r = await api('POST', '/auth/password/reset', { token, body: { password: 'Otra12345' } });
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('recovery_required');
    });

    it('forgot no revela si el correo existe', async () => {
      const r = await api('POST', '/auth/password/forgot', { body: { email: `nadie.${RUN}@prueba.test` } });
      expect(r.status).toBe(200);
    });
  });
});
