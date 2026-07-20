import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';

/**
 * Exercises the real HTTP stack (guards, ValidationPipe, exception filter)
 * against a real Postgres — see DECISION_LOG.md, critical-review
 * remediation 3/5. The 175 apps/api unit tests all mock Prisma directly and
 * cannot catch a broken migration, a misconfigured guard, or module wiring
 * issues; this can.
 *
 * Register/login calls are deliberately budgeted to stay under
 * AuthController's 5-req/min throttle (see DECISION_LOG's rate-limiting
 * entry) — `rate-limit.e2e-spec.ts` has its own app instance (fresh
 * throttler storage) dedicated to proving the 429 behavior, so this file
 * doesn't need to trip it.
 */
describe('Auth (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueUser() {
    const id = randomUUID();
    return {
      email: `e2e-auth-${id}@example.com`,
      password: 'correct-horse-battery-staple',
      name: 'E2E Auth User',
      tenantName: `E2E Auth Tenant ${id}`,
    };
  }

  it('registers a real JWT-shaped token, rejects a duplicate email, and rejects/accepts login', async () => {
    const user = uniqueUser();

    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(user);
    expect(registered.status).toBe(201);
    expect(typeof registered.body.accessToken).toBe('string');
    expect(registered.body.accessToken.split('.')).toHaveLength(3); // real JWT: header.payload.signature
    expect(typeof registered.body.refreshToken).toBe('string');

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(user);
    expect(duplicate.status).toBe(409);

    const wrongPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'not-the-right-password' });
    expect(wrongPassword.status).toBe(401);

    const correct = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password });
    expect(correct.status).toBe(200);
    expect(typeof correct.body.accessToken).toBe('string');
  });

  it('rejects protected routes with no/bad token, accepts a real one, and enforces the real ValidationPipe', async () => {
    const user = uniqueUser();
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(user)
      .expect(201);

    const noToken = await request(app.getHttpServer()).get('/api/v1/incidents');
    expect(noToken.status).toBe(401);

    const badToken = await request(app.getHttpServer())
      .get('/api/v1/incidents')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(badToken.status).toBe(401);

    const withToken = await request(app.getHttpServer())
      .get('/api/v1/incidents')
      .set('Authorization', `Bearer ${registered.body.accessToken}`);
    expect(withToken.status).toBe(200);
    expect(Array.isArray(withToken.body)).toBe(true);

    const unknownField = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...uniqueUser(), notARealField: 'the real ValidationPipe must reject this' });
    expect(unknownField.status).toBe(400);
  });
});
