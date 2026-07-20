import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';

/**
 * End-to-end regression test for the multi-tenant login fix (see
 * DECISION_LOG.md) — against a real Postgres, drives the actual scenario
 * that used to be a dead end: a user added as a member of a second tenant
 * could never log in again at all (POST /auth/login threw 401
 * unconditionally once memberships.length > 1). Confirms the real two-step
 * flow (login -> tenant selection token -> select-tenant) issues a working
 * access token scoped to the chosen tenant, and that the intermediate token
 * cannot be used as a normal bearer token against a protected route (and
 * vice versa: a normal access token cannot be replayed as a tenant
 * selection token).
 *
 * Both register/login/select-tenant calls below share one AuthController
 * throttle bucket (one app instance, one ThrottlerStorage per spec file —
 * see auth.e2e-spec.ts's comment on the same constraint), so this file
 * stays a single test deliberately budgeted under the 5/min limit rather
 * than split across multiple `it` blocks.
 */
describe('Multi-tenant login (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueUser(label: string) {
    const id = randomUUID();
    return {
      email: `e2e-mt-${label}-${id}@example.com`,
      password: 'correct-horse-battery-staple',
      name: `E2E ${label} User`,
      tenantName: `E2E ${label} Tenant ${id}`,
    };
  }

  it('requires an explicit tenant choice for a user in two tenants, and issues a real, correctly-scoped access token', async () => {
    const owner = uniqueUser('owner');
    const registeredOwner = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(owner);
    expect(registeredOwner.status).toBe(201);

    const secondTenantOwner = uniqueUser('second-tenant');
    const registeredSecondOwner = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(secondTenantOwner);
    expect(registeredSecondOwner.status).toBe(201);
    const secondTenantOwnerToken = registeredSecondOwner.body.accessToken as string;

    const secondTenant = await request(app.getHttpServer())
      .get('/api/v1/tenants/me')
      .set('Authorization', `Bearer ${secondTenantOwnerToken}`);
    const secondTenantId = secondTenant.body.id as string;

    const added = await request(app.getHttpServer())
      .post('/api/v1/tenants/me/members')
      .set('Authorization', `Bearer ${secondTenantOwnerToken}`)
      .send({ email: owner.email, role: 'MEMBER' });
    expect(added.status).toBe(201);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: owner.password });

    expect(login.status).toBe(200);
    expect(login.body.tenantSelectionRequired).toBe(true);
    expect(login.body.accessToken).toBeUndefined();
    expect(login.body.tenants).toHaveLength(2);
    expect(login.body.tenants.map((t: { id: string }) => t.id)).toEqual(
      expect.arrayContaining([secondTenantId]),
    );

    const tenantSelectionToken = login.body.tenantSelectionToken as string;

    // The intermediate token must not work as a normal bearer token.
    const misuseAttempt = await request(app.getHttpServer())
      .get('/api/v1/incidents')
      .set('Authorization', `Bearer ${tenantSelectionToken}`);
    expect(misuseAttempt.status).toBe(401);

    // And the reverse: a real access token cannot be replayed as a tenant
    // selection token, even against a tenant its owner genuinely belongs to.
    const replayAttempt = await request(app.getHttpServer())
      .post('/api/v1/auth/select-tenant')
      .send({
        tenantSelectionToken: registeredOwner.body.accessToken,
        tenantId: secondTenantId,
      });
    expect(replayAttempt.status).toBe(401);

    const selected = await request(app.getHttpServer())
      .post('/api/v1/auth/select-tenant')
      .send({ tenantSelectionToken, tenantId: secondTenantId });

    expect(selected.status).toBe(200);
    expect(typeof selected.body.accessToken).toBe('string');
    expect(selected.body.accessToken.split('.')).toHaveLength(3);

    const whoAmI = await request(app.getHttpServer())
      .get('/api/v1/tenants/me')
      .set('Authorization', `Bearer ${selected.body.accessToken}`);
    expect(whoAmI.status).toBe(200);
    expect(whoAmI.body.id).toBe(secondTenantId);
  });
});
