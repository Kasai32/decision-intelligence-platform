import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';

/**
 * End-to-end proof for the entity-relationship intelligence graph and its
 * audit log (see ADR-0021) — against a real Postgres, not mocked Prisma,
 * since this is exactly the class of feature (tenant isolation + an
 * oversight log meant to be tamper-evident) where a mock could hide a
 * real leak the way it did for RLS itself (see DECISION_LOG.md).
 */
describe('Entities, relationships, and the audit log (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerTenant(label: string) {
    const id = randomUUID();
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `e2e-${label}-${id}@example.com`,
        password: 'correct-horse-battery-staple',
        name: `E2E ${label} User`,
        tenantName: `E2E ${label} Tenant ${id}`,
      });
    return res.body.accessToken as string;
  }

  it('builds a real entity + relationship graph from real evidence, and every read/write is logged for oversight', async () => {
    const token = await registerTenant('graph');
    const auth = { Authorization: `Bearer ${token}` };

    const incident = await request(app.getHttpServer()).post('/api/v1/incidents').set(auth).send({
      title: 'Suspicious cross-border transfers',
      description: 'Pattern of transfers flagged by monitoring',
      severity: 'HIGH',
      type: 'OTHER',
    });
    expect(incident.status).toBe(201);

    const evidence = await request(app.getHttpServer()).post('/api/v1/evidence').set(auth).send({
      incidentId: incident.body.id,
      type: 'LOG',
      sourceCategory: 'MONITORING',
      source: 'Transaction monitor',
      summary: 'John Smith wired $50,000 to Acme Holdings on three occasions.',
    });
    expect(evidence.status).toBe(201);

    // Two entities, both citing the same real evidence — never a bare assertion.
    const person = await request(app.getHttpServer())
      .post('/api/v1/entities')
      .set(auth)
      .send({ type: 'PERSON', name: 'John Smith', evidenceId: evidence.body.id });
    expect(person.status).toBe(201);

    const org = await request(app.getHttpServer())
      .post('/api/v1/entities')
      .set(auth)
      .send({ type: 'ORGANIZATION', name: 'Acme Holdings', evidenceId: evidence.body.id });
    expect(org.status).toBe(201);

    // Search requires a stated reason — purpose limitation, not decoration.
    const searchNoReason = await request(app.getHttpServer())
      .get('/api/v1/entities')
      .query({ query: 'Smith' })
      .set(auth);
    expect(searchNoReason.status).toBe(400);

    const search = await request(app.getHttpServer())
      .get('/api/v1/entities')
      .query({ query: 'Smith', reason: 'cross-referencing flagged transfer pattern' })
      .set(auth);
    expect(search.status).toBe(200);
    expect(search.body.map((e: { id: string }) => e.id)).toContain(person.body.id);

    // A relationship starts SUGGESTED even though real evidence was cited —
    // confirming is a separate, explicit human act (Principle 1).
    const relationship = await request(app.getHttpServer())
      .post('/api/v1/relationships')
      .set(auth)
      .send({
        fromEntityId: person.body.id,
        toEntityId: org.body.id,
        type: 'TRANSACTED_WITH',
        evidenceId: evidence.body.id,
      });
    expect(relationship.status).toBe(201);
    expect(relationship.body.status).toBe('SUGGESTED');

    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/relationships/${relationship.body.id}/confirm`)
      .set(auth);
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.status).toBe('CONFIRMED');

    const graph = await request(app.getHttpServer())
      .get(`/api/v1/entities/${person.body.id}/graph`)
      .query({ reason: 'mapping known financial associates' })
      .set(auth);
    expect(graph.status).toBe(200);
    expect(graph.body.relationships).toHaveLength(1);
    expect(graph.body.relationships[0].status).toBe('CONFIRMED');

    // Every one of the above reads/writes should now be on the audit log —
    // the mechanism that makes "human analyst in control" real, not a slogan.
    const auditLog = await request(app.getHttpServer()).get('/api/v1/audit-log').set(auth);
    expect(auditLog.status).toBe(200);
    const actions = auditLog.body.map((entry: { action: string }) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'CREATE_ENTITY',
        'SEARCH',
        'CREATE_RELATIONSHIP',
        'CONFIRM_RELATIONSHIP',
        'VIEW_GRAPH',
      ]),
    );
    const searchEntry = auditLog.body.find(
      (entry: { action: string }) => entry.action === 'SEARCH',
    );
    expect(searchEntry.reason).toBe('cross-referencing flagged transfer pattern');
  });

  it("never leaks tenant A's entities, relationships, or audit log into tenant B's view", async () => {
    const tokenA = await registerTenant('secure-a');
    const tokenB = await registerTenant('secure-b');
    const authA = { Authorization: `Bearer ${tokenA}` };
    const authB = { Authorization: `Bearer ${tokenB}` };

    const incident = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set(authA)
      .send({ title: 'Tenant A incident', description: 'desc', severity: 'LOW', type: 'OTHER' });
    const evidence = await request(app.getHttpServer()).post('/api/v1/evidence').set(authA).send({
      incidentId: incident.body.id,
      type: 'LOG',
      sourceCategory: 'OTHER',
      source: 'internal',
      summary: 'Confidential to tenant A',
    });
    const entity = await request(app.getHttpServer()).post('/api/v1/entities').set(authA).send({
      type: 'PERSON',
      name: 'Tenant A Confidential Subject',
      evidenceId: evidence.body.id,
    });
    expect(entity.status).toBe(201);

    const crossTenantView = await request(app.getHttpServer())
      .get(`/api/v1/entities/${entity.body.id}`)
      .query({ reason: 'attempting cross-tenant access' })
      .set(authB);
    expect(crossTenantView.status).toBe(404);

    const crossTenantSearch = await request(app.getHttpServer())
      .get('/api/v1/entities')
      .query({ query: 'Confidential', reason: 'attempting cross-tenant search' })
      .set(authB);
    expect(crossTenantSearch.status).toBe(200);
    expect(crossTenantSearch.body).toEqual([]);

    const auditLogA = await request(app.getHttpServer()).get('/api/v1/audit-log').set(authA);
    const auditLogB = await request(app.getHttpServer()).get('/api/v1/audit-log').set(authB);
    expect(
      auditLogA.body.some((entry: { targetId: string }) => entry.targetId === entity.body.id),
    ).toBe(true);
    expect(
      auditLogB.body.some((entry: { targetId: string }) => entry.targetId === entity.body.id),
    ).toBe(false);
  });

  it('only an ADMIN (or above) can review the audit log', async () => {
    const ownerToken = await registerTenant('roles-owner');
    const ownerAuth = { Authorization: `Bearer ${ownerToken}` };
    const ownerTenant = await request(app.getHttpServer()).get('/api/v1/tenants/me').set(ownerAuth);
    const ownerTenantId = ownerTenant.body.id as string;

    const memberEmail = `e2e-roles-member-${randomUUID()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: memberEmail,
        password: 'correct-horse-battery-staple',
        name: 'Member',
        tenantName: `Member's own tenant ${randomUUID()}`,
      });
    await request(app.getHttpServer())
      .post('/api/v1/tenants/me/members')
      .set(ownerAuth)
      .send({ email: memberEmail, role: 'MEMBER' });

    // The member now belongs to two tenants — their own (OWNER there) and
    // the one they were just added to (MEMBER there) — must select the
    // latter explicitly (see ADR-0017) to get a token scoped to it.
    const memberLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: memberEmail, password: 'correct-horse-battery-staple' });
    expect(memberLogin.body.tenantSelectionRequired).toBe(true);

    const selected = await request(app.getHttpServer()).post('/api/v1/auth/select-tenant').send({
      tenantSelectionToken: memberLogin.body.tenantSelectionToken,
      tenantId: ownerTenantId,
    });
    const memberAuth = { Authorization: `Bearer ${selected.body.accessToken}` };

    const asOwner = await request(app.getHttpServer()).get('/api/v1/audit-log').set(ownerAuth);
    expect(asOwner.status).toBe(200);

    const asMember = await request(app.getHttpServer()).get('/api/v1/audit-log').set(memberAuth);
    expect(asMember.status).toBe(403);
  });
});
