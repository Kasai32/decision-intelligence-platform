import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';

/**
 * End-to-end regression test for the confidenceDimensions response-shape
 * fix (see DECISION_LOG.md, 2026-07-20) — against a real Postgres, not a
 * mocked Prisma client, confirms POST /incidents/:id/analyze and
 * GET /incidents/:id/analyses genuinely agree on shape, closing the exact
 * gap that let the original inconsistency ship unnoticed through 175
 * Prisma-mocked unit tests.
 */
describe('Decision Intelligence Engine (e2e)', () => {
  let app: NestExpressApplication;
  let accessToken: string;

  beforeAll(async () => {
    app = await bootstrapTestApp();

    const id = randomUUID();
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `e2e-di-${id}@example.com`,
        password: 'correct-horse-battery-staple',
        name: 'E2E DI User',
        tenantName: `E2E DI Tenant ${id}`,
      });
    accessToken = registered.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  function auth() {
    return { Authorization: `Bearer ${accessToken}` };
  }

  it('computes confidence dimensions from real evidence and returns the same flat shape from both analyze() and list()', async () => {
    const incident = await request(app.getHttpServer()).post('/api/v1/incidents').set(auth()).send({
      title: 'Cloud provider outage, partial evidence',
      description: 'Payments API returning 500s',
      severity: 'HIGH',
      type: 'CLOUD_OUTAGE',
    });
    expect(incident.status).toBe(201);
    const incidentId = incident.body.id as string;

    const evidence = await request(app.getHttpServer()).post('/api/v1/evidence').set(auth()).send({
      incidentId,
      type: 'METRIC',
      sourceCategory: 'MONITORING',
      source: 'Datadog',
      summary: 'Error rate spiked to 42% at 11:40',
    });
    expect(evidence.status).toBe(201);

    const analyzeBody = {
      situationSummary: 'Payments API returning elevated 5xx rates since 11:40.',
      businessImpact: {
        level: 'HIGH',
        description: 'Checkout failures for a subset of customers.',
        affectedSystems: ['payments-api'],
      },
      criticalRisks: [
        { description: 'Revenue loss during peak hours', likelihood: 'HIGH', impact: 'HIGH' },
      ],
      conflictingInformation: [],
      recommendedDecision: { label: 'Roll back', description: 'Roll back the 11:35 deploy.' },
      alternativeDecisions: [
        { label: 'Hotfix forward', description: 'Ship a targeted patch instead.' },
      ],
      expectedConsequences: 'Brief additional downtime during rollback, then recovery.',
      immediateNextActions: ['Page on-call', 'Notify status page'],
      executiveSummary: 'Recommend rollback; evidence supports a bad deploy as root cause.',
    };

    const analyzed = await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/analyze`)
      .set(auth())
      .send(analyzeBody);

    expect(analyzed.status).toBe(201);
    // CLOUD_OUTAGE requires [MONITORING, CLOUD_PROVIDER]; only MONITORING present -> 50 (matches ADR-0010's example).
    expect(analyzed.body.evidenceCompleteness).toBe(50);
    expect(typeof analyzed.body.sourceReliability).toBe('number');
    expect(typeof analyzed.body.dataFreshness).toBe('number');
    expect(typeof analyzed.body.aiCertainty).toBe('number');
    expect(analyzed.body.confidenceDimensions).toBeUndefined();
    expect(analyzed.body.missingInformation).toEqual(
      expect.arrayContaining([expect.stringContaining('CLOUD_PROVIDER')]),
    );

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}/analyses`)
      .set(auth());

    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    const [persisted] = listed.body;
    expect(persisted.confidenceDimensions).toBeUndefined();
    expect(persisted.evidenceCompleteness).toBe(analyzed.body.evidenceCompleteness);
    expect(persisted.sourceReliability).toBe(analyzed.body.sourceReliability);
    expect(persisted.dataFreshness).toBe(analyzed.body.dataFreshness);
    expect(persisted.aiCertainty).toBe(analyzed.body.aiCertainty);
    expect(persisted.id).toBe(analyzed.body.id);
  });
});
