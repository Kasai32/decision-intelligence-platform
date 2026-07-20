import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';

/**
 * End-to-end proof for ADR-0016's calibration feature: a real decision
 * lifecycle (open → analyze → decide → close → record outcome) against a
 * real Postgres, then a real, computed calibration report — not a mocked
 * Prisma client standing in for the actual GOOD/BAD aggregation.
 */
describe('Decision outcomes and calibration (e2e)', () => {
  let app: NestExpressApplication;
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await bootstrapTestApp();

    const id = randomUUID();
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `e2e-calibration-${id}@example.com`,
        password: 'correct-horse-battery-staple',
        name: 'E2E Calibration User',
        tenantName: `E2E Calibration Tenant ${id}`,
      });
    accessToken = registered.body.accessToken;
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString()) as {
      sub: string;
    };
    userId = payload.sub;
  });

  afterAll(async () => {
    await app.close();
  });

  function auth() {
    return { Authorization: `Bearer ${accessToken}` };
  }

  async function runDecisionToClosedOutcome(
    evidenceCompleteness: 'high' | 'low',
    outcomeQuality: 'GOOD' | 'BAD',
  ) {
    const incident = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set(auth())
      .send({
        title: `Calibration probe (${outcomeQuality})`,
        description: 'e2e',
        severity: 'HIGH',
        type: 'CLOUD_OUTAGE',
      });
    const incidentId = incident.body.id as string;

    if (evidenceCompleteness === 'high') {
      await request(app.getHttpServer()).post('/api/v1/evidence').set(auth()).send({
        incidentId,
        type: 'METRIC',
        sourceCategory: 'MONITORING',
        source: 'Datadog',
        summary: 'CPU spike',
      });
      await request(app.getHttpServer()).post('/api/v1/evidence').set(auth()).send({
        incidentId,
        type: 'LOG',
        sourceCategory: 'CLOUD_PROVIDER',
        source: 'AWS',
        summary: 'Instance restart log',
      });
    }

    const analyzed = await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/analyze`)
      .set(auth())
      .send({
        situationSummary: 'probe',
        businessImpact: { level: 'HIGH', description: 'probe', affectedSystems: [] },
        criticalRisks: [],
        conflictingInformation: [],
        recommendedDecision: { label: 'Roll back', description: 'probe' },
        alternativeDecisions: [],
        expectedConsequences: 'probe',
        immediateNextActions: [],
        executiveSummary: 'probe',
      });

    const decision = await request(app.getHttpServer())
      .post('/api/v1/decisions')
      .set(auth())
      .send({ incidentId, question: 'Roll back the deploy?' });
    const decisionId = decision.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/decisions/${decisionId}/decide`)
      .set(auth())
      .send({ humanDecision: 'Roll back', decidedByUserId: userId, rationale: 'e2e' });

    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${incidentId}/status`)
      .set(auth())
      .send({ status: 'MITIGATED' });
    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${incidentId}/status`)
      .set(auth())
      .send({ status: 'RESOLVED' });
    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${incidentId}/status`)
      .set(auth())
      .send({ status: 'CLOSED' });

    const outcome = await request(app.getHttpServer())
      .post(`/api/v1/decisions/${decisionId}/outcome`)
      .set(auth())
      .send({ outcomeQuality, notes: 'e2e' });

    return { incidentId, decisionId, outcome, analyzedBody: analyzed.body };
  }

  it('rejects recording an outcome before the incident is CLOSED and before the decision is DECIDED', async () => {
    const incident = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set(auth())
      .send({ title: 'Gate probe', description: 'e2e' });
    const decisionOpen = await request(app.getHttpServer())
      .post('/api/v1/decisions')
      .set(auth())
      .send({ incidentId: incident.body.id, question: 'Still open?' });

    const tooEarly = await request(app.getHttpServer())
      .post(`/api/v1/decisions/${decisionOpen.body.id}/outcome`)
      .set(auth())
      .send({ outcomeQuality: 'GOOD' });
    expect(tooEarly.status).toBe(400);
  });

  it('records real decision outcomes and computes a real calibration report from them', async () => {
    const good = await runDecisionToClosedOutcome('high', 'GOOD');
    expect(good.outcome.status).toBe(201);
    expect(good.outcome.body.intelligenceAnalysisId).toBe(good.analyzedBody.id);

    const bad1 = await runDecisionToClosedOutcome('low', 'BAD');
    const bad2 = await runDecisionToClosedOutcome('low', 'BAD');
    expect(bad1.outcome.status).toBe(201);
    expect(bad2.outcome.status).toBe(201);

    const report = await request(app.getHttpServer())
      .get('/api/v1/decision-intelligence/calibration-report')
      .set(auth());

    expect(report.status).toBe(200);
    expect(report.body.totalLabeledOutcomes).toBe(3);
    const evidenceCompleteness = report.body.dimensions.find(
      (d: { dimension: string }) => d.dimension === 'evidenceCompleteness',
    );
    // High-evidence run (2 of 2 required categories present) -> 100; low-evidence runs (0 present) -> 0.
    expect(evidenceCompleteness.meanWhenGood).toBe(100);
    expect(evidenceCompleteness.meanWhenBad).toBe(0);
    expect(evidenceCompleteness.meanDifference).toBe(100);
  });
});
