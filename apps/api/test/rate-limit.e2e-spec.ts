import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';

/**
 * Dedicated app instance (fresh in-memory ThrottlerStorage, see
 * DECISION_LOG.md's rate-limiting entry) so this file's login attempts
 * don't share a quota with auth.e2e-spec.ts's — deterministic proof that
 * the 6th rapid POST /auth/login is actually rejected, over the real HTTP
 * stack, not asserted against mocked guard metadata.
 */
describe('Rate limiting (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows 5 login attempts per minute and rejects the 6th with 429', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'rate-limit-e2e@example.com', password: 'wrong-password' });

    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await attempt();
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });
});
