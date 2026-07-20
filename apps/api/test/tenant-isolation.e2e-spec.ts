import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { runInTenantContext } from '../src/prisma/tenant-rls.context';
import { bootstrapTestApp } from './utils/bootstrap-app';

/**
 * Proves tenant isolation end-to-end against a real database (see
 * DECISION_LOG.md, critical-review remediation 3/5) — ADR-0004's
 * shared-schema multi-tenancy relies entirely on every query remembering
 * `where: { tenantId }`; the 175 mocked unit tests can't catch a real
 * cross-tenant leak the way hitting two real tenants' data over real HTTP
 * can.
 */
describe('Tenant isolation (e2e)', () => {
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
        email: `e2e-tenant-${id}@example.com`,
        password: 'correct-horse-battery-staple',
        name: 'E2E Tenant User',
        tenantName: `E2E Isolation Tenant ${id}`,
      });
    return res.body.accessToken as string;
  }

  it("never leaks tenant A's incidents into tenant B's list or detail view", async () => {
    const tokenA = await registerTenant();
    const tokenB = await registerTenant();

    const created = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Tenant A only incident', description: 'Should never be visible to tenant B' });
    expect(created.status).toBe(201);
    const incidentId = created.body.id as string;

    const tenantAList = await request(app.getHttpServer())
      .get('/api/v1/incidents')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(tenantAList.body.some((incident: { id: string }) => incident.id === incidentId)).toBe(true);

    const tenantBList = await request(app.getHttpServer())
      .get('/api/v1/incidents')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(tenantBList.body.some((incident: { id: string }) => incident.id === incidentId)).toBe(false);

    const tenantBDetail = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(tenantBDetail.status).toBe(404);

    const tenantADetail = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(tenantADetail.status).toBe(200);
  });

  it('Postgres RLS itself blocks a raw query with no app-level WHERE tenantId at all (see ADR-0015)', async () => {
    const tokenA = await registerTenant();
    const created = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'RLS adversarial probe', description: 'Direct-SQL bypass attempt' });
    expect(created.status).toBe(201);
    const incidentId = created.body.id as string;
    const tenantId = created.body.tenantId as string;

    const prisma = app.get(PrismaService);

    // Deliberately no `WHERE "tenantId" = ...` here at all — simulates the
    // exact app-code mistake ADR-0004's isolation depends on never
    // happening. With no RLS session context active, Postgres itself
    // (FORCE ROW LEVEL SECURITY) must still return zero rows.
    const withNoTenantContext = await prisma.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "incidents" WHERE id = ${incidentId}`;
    expect(withNoTenantContext).toHaveLength(0);

    // Same unfiltered query, but with the correct tenant context set —
    // proves the policy is actually scoping by tenant, not just blocking
    // everything unconditionally.
    const withCorrectTenantContext = await runInTenantContext(prisma, tenantId, () =>
      prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "incidents" WHERE id = ${incidentId}`,
    );
    expect(withCorrectTenantContext).toHaveLength(1);

    // And with a fabricated, unrelated tenant context — still zero rows.
    const withWrongTenantContext = await runInTenantContext(prisma, randomUUID(), () =>
      prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "incidents" WHERE id = ${incidentId}`,
    );
    expect(withWrongTenantContext).toHaveLength(0);
  });
});
