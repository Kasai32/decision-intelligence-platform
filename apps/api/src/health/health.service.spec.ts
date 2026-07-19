import { HealthService } from './health.service';

describe('HealthService', () => {
  const service = new HealthService();

  it('reports ok status', () => {
    const result = service.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('api');
  });

  it('returns a valid ISO timestamp', () => {
    const result = service.check();
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});
