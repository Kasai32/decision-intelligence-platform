import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap-app';

/**
 * End-to-end proof for geospatial entity search (see ADR-0022) — real
 * WGS84 coordinates for real cities, against a real Postgres, since the
 * whole point is proving the distance math and the radius filter behave
 * correctly on real data, not just a hand-picked mock.
 */
describe('Geospatial entity search (e2e)', () => {
  let app: NestExpressApplication;
  let token: string;
  let auth: { Authorization: string };

  beforeAll(async () => {
    app = await bootstrapTestApp();

    const id = randomUUID();
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `e2e-geo-${id}@example.com`,
        password: 'correct-horse-battery-staple',
        name: 'E2E Geo User',
        tenantName: `E2E Geo Tenant ${id}`,
      });
    token = registered.body.accessToken;
    auth = { Authorization: `Bearer ${token}` };
  });

  afterAll(async () => {
    await app.close();
  });

  it('maps where things happened: creates located entities, validates coordinates, filters by real distance, and logs it all', async () => {
    const incident = await request(app.getHttpServer()).post('/api/v1/incidents').set(auth).send({
      title: 'Field office break-in pattern',
      description: 'Coordinated break-ins reported at multiple offices',
      severity: 'HIGH',
      type: 'OTHER',
    });
    expect(incident.status).toBe(201);

    const evidence = await request(app.getHttpServer()).post('/api/v1/evidence').set(auth).send({
      incidentId: incident.body.id,
      type: 'HUMAN_INPUT',
      sourceCategory: 'HUMAN',
      source: 'Field report',
      summary: 'Break-ins reported at the D.C., New York, and Los Angeles offices.',
    });
    expect(evidence.status).toBe(201);

    // A latitude with no longitude must be rejected — never a half coordinate.
    const invalidCoords = await request(app.getHttpServer())
      .post('/api/v1/entities')
      .set(auth)
      .send({
        type: 'LOCATION',
        name: 'Incomplete Coordinates Office',
        evidenceId: evidence.body.id,
        latitude: 38.9072,
      });
    expect(invalidCoords.status).toBe(400);

    const dc = await request(app.getHttpServer()).post('/api/v1/entities').set(auth).send({
      type: 'LOCATION',
      name: 'Washington D.C. Office',
      evidenceId: evidence.body.id,
      latitude: 38.9072,
      longitude: -77.0369,
    });
    expect(dc.status).toBe(201);

    const nyc = await request(app.getHttpServer()).post('/api/v1/entities').set(auth).send({
      type: 'LOCATION',
      name: 'New York Office',
      evidenceId: evidence.body.id,
      latitude: 40.7128,
      longitude: -74.006,
    });
    expect(nyc.status).toBe(201);

    const la = await request(app.getHttpServer()).post('/api/v1/entities').set(auth).send({
      type: 'LOCATION',
      name: 'Los Angeles Office',
      evidenceId: evidence.body.id,
      latitude: 34.0522,
      longitude: -118.2437,
    });
    expect(la.status).toBe(201);

    // Search near D.C. requires a reason (purpose limitation) — 400 without one.
    const noReason = await request(app.getHttpServer())
      .get('/api/v1/entities/nearby')
      .query({ latitude: 38.9072, longitude: -77.0369, radiusKm: 500 })
      .set(auth);
    expect(noReason.status).toBe(400);

    // Real distances: D.C.-NYC ~330km, D.C.-LA ~3900km — a 500km radius
    // should include NYC (and D.C. itself) but exclude LA.
    const nearby = await request(app.getHttpServer())
      .get('/api/v1/entities/nearby')
      .query({
        latitude: 38.9072,
        longitude: -77.0369,
        radiusKm: 500,
        reason: 'mapping the break-in pattern radius',
      })
      .set(auth);
    expect(nearby.status).toBe(200);
    const nearbyIds = nearby.body.map((e: { id: string }) => e.id);
    expect(nearbyIds).toContain(dc.body.id);
    expect(nearbyIds).toContain(nyc.body.id);
    expect(nearbyIds).not.toContain(la.body.id);
    // Nearest-first: D.C. itself (distance 0) before New York.
    expect(nearby.body[0].id).toBe(dc.body.id);

    // The map endpoint returns every located entity, no radius filter.
    const map = await request(app.getHttpServer())
      .get('/api/v1/entities/map')
      .query({ reason: 'rendering the full office map' })
      .set(auth);
    expect(map.status).toBe(200);
    const mapIds = map.body.map((e: { id: string }) => e.id);
    expect(mapIds).toEqual(expect.arrayContaining([dc.body.id, nyc.body.id, la.body.id]));

    // Every geospatial read is on the audit log too.
    const auditLog = await request(app.getHttpServer()).get('/api/v1/audit-log').set(auth);
    expect(auditLog.status).toBe(200);
    const auditActions = auditLog.body.map((entry: { action: string }) => entry.action);
    expect(auditActions).toEqual(expect.arrayContaining(['SEARCH', 'VIEW_MAP']));
  });
});
