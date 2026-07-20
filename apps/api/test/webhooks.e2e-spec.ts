import { createHmac, randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';

const WEBHOOK_SECRET = 'e2e-webhook-secret-fixture';

/**
 * Proves the webhook path's Postgres RLS wiring works live (see
 * ADR-0015) — unlike every JWT-authenticated route (covered by
 * TenantRlsInterceptor), this route establishes tenant context explicitly
 * in WebhookSignatureGuard/WebhooksController, since it's authenticated by
 * HMAC before any guard/interceptor that could rely on `request.user`
 * runs. The existing unit tests mock Prisma entirely and can't catch a
 * real RLS/least-privilege-role misconfiguration breaking this path.
 */
describe('Webhooks (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  function sign(body: Buffer): string {
    return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  }

  it('accepts a correctly signed webhook and records real, tenant-scoped Evidence', async () => {
    const id = randomUUID();
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `e2e-webhook-${id}@example.com`,
        password: 'correct-horse-battery-staple',
        name: 'E2E Webhook User',
        tenantName: `E2E Webhook Tenant ${id}`,
      });
    const accessToken = registered.body.accessToken as string;

    const incident = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Webhook RLS probe', description: 'Exercises the guard-level RLS context' });
    expect(incident.status).toBe(201);
    const tenantId = incident.body.tenantId as string;

    const configured = await request(app.getHttpServer())
      .post('/api/v1/integrations/SPLUNK/config')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ credentials: { webhookSecret: WEBHOOK_SECRET } });
    expect(configured.status).toBe(201);

    const payload = { incidentId: incident.body.id, summary: 'Anomalous CPU spike detected' };
    const bodyText = JSON.stringify(payload);
    const rawBody = Buffer.from(bodyText);

    const forged = await request(app.getHttpServer())
      .post(`/webhooks/${tenantId}/SPLUNK`)
      .set('x-signature', '0'.repeat(64))
      .send(payload);
    expect(forged.status).toBe(401);

    const valid = await request(app.getHttpServer())
      .post(`/webhooks/${tenantId}/SPLUNK`)
      .set('x-signature', sign(rawBody))
      .set('Content-Type', 'application/json')
      .send(bodyText);
    expect(valid.status).toBe(201);
    expect(valid.body.tenantId).toBe(tenantId);
    expect(valid.body.summary).toBe(payload.summary);
    expect(valid.body.submittedByUserId).toBeNull();
  });
});
