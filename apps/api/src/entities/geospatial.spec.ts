import { haversineDistanceKm } from './geospatial';

describe('haversineDistanceKm', () => {
  it('returns 0 for the same point', () => {
    expect(haversineDistanceKm(40.7128, -74.006, 40.7128, -74.006)).toBeCloseTo(0, 5);
  });

  it('matches the well-known real-world distance between New York and London (~5570 km)', () => {
    const distance = haversineDistanceKm(40.7128, -74.006, 51.5074, -0.1278);
    expect(distance).toBeGreaterThan(5500);
    expect(distance).toBeLessThan(5600);
  });

  it('matches the well-known real-world distance between Washington, D.C. and New York (~330 km)', () => {
    const distance = haversineDistanceKm(38.9072, -77.0369, 40.7128, -74.006);
    expect(distance).toBeGreaterThan(300);
    expect(distance).toBeLessThan(360);
  });

  it('is symmetric — distance(A, B) equals distance(B, A)', () => {
    const ab = haversineDistanceKm(38.9072, -77.0369, 40.7128, -74.006);
    const ba = haversineDistanceKm(40.7128, -74.006, 38.9072, -77.0369);
    expect(ab).toBeCloseTo(ba, 10);
  });
});
