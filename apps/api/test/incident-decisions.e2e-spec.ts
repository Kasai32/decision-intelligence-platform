import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';

/**
 * End-to-end regression test for GET /incidents/:id/decisions (see
 * DECISION_LOG.md) — apps/web previously had no dedicated "list decisions
 * for an incident" endpoint and derived the list by regex-parsing timeline
 * event descriptions instead. This confirms the real endpoint returns every
 * decision for the incident, in the order opened, and stays tenant-scoped.
 */
describe('GET /incidents/:id/decisions (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerTenant() {
    const id = randomUUID();
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `e2e-decisions-${id}@example.com`,
        password: 'correct-horse-battery-staple',
        name: 'E2E Decisions User',
        tenantName: `E2E Decisions Tenant ${id}`,
      });
    return res.body.accessToken as string;
  }

  it('returns every decision opened for the incident, oldest first', async () => {
    const accessToken = await registerTenant();
    const auth = { Authorization: `Bearer ${accessToken}` };

    const incident = await request(app.getHttpServer()).post('/api/v1/incidents').set(auth).send({
      title: 'Payments outage',
      description: 'Checkout returning 500s',
      severity: 'HIGH',
      type: 'CLOUD_OUTAGE',
    });
    expect(incident.status).toBe(201);
    const incidentId = incident.body.id as string;

    const first = await request(app.getHttpServer())
      .post('/api/v1/decisions')
      .set(auth)
      .send({ incidentId, question: 'Roll back the deploy?' });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/api/v1/decisions')
      .set(auth)
      .send({ incidentId, question: 'Notify affected customers?' });
    expect(second.status).toBe(201);

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}/decisions`)
      .set(auth);

    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(2);
    expect(listed.body.map((d: { id: string }) => d.id)).toEqual([first.body.id, second.body.id]);
    expect(listed.body[0].question).toBe('Roll back the deploy?');
    expect(listed.body[1].question).toBe('Notify affected customers?');
  });

  it("never leaks another tenant's decisions and 404s on an incident outside the tenant", async () => {
    const tenantAToken = await registerTenant();
    const tenantBToken = await registerTenant();

    const incident = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set({ Authorization: `Bearer ${tenantAToken}` })
      .send({
        title: 'Tenant A incident',
        description: 'Only tenant A should see this',
        severity: 'LOW',
        type: 'CLOUD_OUTAGE',
      });
    const incidentId = incident.body.id as string;

    await request(app.getHttpServer())
      .post('/api/v1/decisions')
      .set({ Authorization: `Bearer ${tenantAToken}` })
      .send({ incidentId, question: "Tenant A's decision" });

    const crossTenantAttempt = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}/decisions`)
      .set({ Authorization: `Bearer ${tenantBToken}` });

    expect(crossTenantAttempt.status).toBe(404);
  });
});
