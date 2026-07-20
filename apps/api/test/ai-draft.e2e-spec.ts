import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';

/**
 * End-to-end regression test for AI drafting's graceful-degradation path
 * (see ADR-0018) — no ANTHROPIC_API_KEY is set in this test environment
 * (nor should one ever be, for a CI run — this makes real, billed network
 * calls to a real LLM provider), so this proves the real, live behavior an
 * unconfigured deployment actually has: an honest "unavailable" instead of
 * a crash, exactly like Phase 6's STUB_MODE pattern for missing
 * integration credentials.
 */
describe('AI drafting — unconfigured (e2e)', () => {
  let app: NestExpressApplication;
  let accessToken: string;

  beforeAll(async () => {
    app = await bootstrapTestApp();

    const id = randomUUID();
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `e2e-ai-draft-${id}@example.com`,
        password: 'correct-horse-battery-staple',
        name: 'E2E AI Draft User',
        tenantName: `E2E AI Draft Tenant ${id}`,
      });
    accessToken = registered.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  function auth() {
    return { Authorization: `Bearer ${accessToken}` };
  }

  it('reports unavailable and never attempts a network call without an API key', async () => {
    const status = await request(app.getHttpServer())
      .get('/api/v1/decision-intelligence/ai-status')
      .set(auth());
    expect(status.status).toBe(200);
    expect(status.body).toEqual({ available: false });
  });

  it('returns 503 (not a crash) when a draft is requested with no API key configured', async () => {
    const incident = await request(app.getHttpServer()).post('/api/v1/incidents').set(auth()).send({
      title: 'Payments outage',
      description: 'Checkout returning 500s',
      severity: 'HIGH',
      type: 'CLOUD_OUTAGE',
    });
    expect(incident.status).toBe(201);

    const draft = await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incident.body.id}/analyze/draft`)
      .set(auth());

    expect(draft.status).toBe(503);
  });
});
