import { IncidentSeverity } from '@prisma/client';
import { computeDataFreshness, explainDataFreshness } from './data-freshness';

const BASE_TIME = new Date('2026-07-19T12:00:00.000Z');

function minutesAgo(minutes: number): Date {
  return new Date(BASE_TIME.getTime() - minutes * 60_000);
}

describe('computeDataFreshness — time-based degradation', () => {
  it('returns 0 when there is no evidence at all', () => {
    expect(computeDataFreshness([], IncidentSeverity.CRITICAL, BASE_TIME)).toBe(0);
  });

  it('returns 100 for evidence created at exactly "now"', () => {
    expect(
      computeDataFreshness([{ createdAt: BASE_TIME }], IncidentSeverity.MEDIUM, BASE_TIME),
    ).toBe(100);
  });

  it('degrades monotonically as elapsed time increases, for a fixed severity', () => {
    const scores = [0, 5, 15, 30, 60].map((minutes) =>
      computeDataFreshness([{ createdAt: minutesAgo(minutes) }], IncidentSeverity.HIGH, BASE_TIME),
    );
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
    expect(scores[0]).toBe(100);
  });

  it('matches the exact freshness = max(0, 100 - Δt × k) formula for CRITICAL (k=5)', () => {
    // At 5 minutes old: 100 - 5*5 = 75
    expect(
      computeDataFreshness([{ createdAt: minutesAgo(5) }], IncidentSeverity.CRITICAL, BASE_TIME),
    ).toBe(75);
    // At 20 minutes old: 100 - 20*5 = 0 (floor)
    expect(
      computeDataFreshness([{ createdAt: minutesAgo(20) }], IncidentSeverity.CRITICAL, BASE_TIME),
    ).toBe(0);
    // Never goes negative, even far past the zero point
    expect(
      computeDataFreshness([{ createdAt: minutesAgo(500) }], IncidentSeverity.CRITICAL, BASE_TIME),
    ).toBe(0);
  });

  it('degrades far more slowly for LOW severity than CRITICAL at the same elapsed time', () => {
    const critical = computeDataFreshness(
      [{ createdAt: minutesAgo(10) }],
      IncidentSeverity.CRITICAL,
      BASE_TIME,
    );
    const low = computeDataFreshness(
      [{ createdAt: minutesAgo(10) }],
      IncidentSeverity.LOW,
      BASE_TIME,
    );
    expect(low).toBeGreaterThan(critical);
  });

  it('uses the MOST RECENT evidence when several exist, ignoring older ones', () => {
    const result = computeDataFreshness(
      [{ createdAt: minutesAgo(120) }, { createdAt: minutesAgo(2) }, { createdAt: minutesAgo(80) }],
      IncidentSeverity.MEDIUM,
      BASE_TIME,
    );
    // Should reflect the 2-minute-old evidence (100 - 2*1 = 98), not the 120-minute-old one.
    expect(result).toBe(98);
  });

  it('is exactly reproducible given a fixed "now" — no reliance on the system clock', () => {
    const a = computeDataFreshness(
      [{ createdAt: minutesAgo(7) }],
      IncidentSeverity.HIGH,
      BASE_TIME,
    );
    const b = computeDataFreshness(
      [{ createdAt: minutesAgo(7) }],
      IncidentSeverity.HIGH,
      BASE_TIME,
    );
    expect(a).toBe(b);
  });
});

describe('explainDataFreshness', () => {
  it('names the exact evidence, elapsed minutes, and degradation factor behind the score', () => {
    const breakdown = explainDataFreshness(
      [
        { id: 'ev-old', createdAt: minutesAgo(120) },
        { id: 'ev-new', createdAt: minutesAgo(5) },
      ],
      IncidentSeverity.CRITICAL,
      BASE_TIME,
    );

    expect(breakdown.score).toBe(75); // 100 - 5*5
    expect(breakdown.mostRecentEvidenceId).toBe('ev-new');
    expect(breakdown.minutesSinceMostRecent).toBe(5);
    expect(breakdown.degradationFactorPerMinute).toBe(5);
    expect(breakdown.severity).toBe(IncidentSeverity.CRITICAL);
  });

  it('reports a null evidence reference for an incident with no evidence at all', () => {
    const breakdown = explainDataFreshness([], IncidentSeverity.MEDIUM, BASE_TIME);
    expect(breakdown.score).toBe(0);
    expect(breakdown.mostRecentEvidenceId).toBeNull();
    expect(breakdown.minutesSinceMostRecent).toBeNull();
  });
});
