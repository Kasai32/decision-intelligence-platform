import { EvidenceSourceCategory, IncidentType } from '@prisma/client';
import { computeEvidenceCompleteness } from './evidence-completeness';

describe('computeEvidenceCompleteness', () => {
  it('returns 100 when no evidence sources are required (OTHER incident type)', () => {
    expect(computeEvidenceCompleteness(IncidentType.OTHER, [])).toBe(100);
  });

  it('matches the ADR-0010 example: CLOUD_OUTAGE with one of two required sources -> 50', () => {
    expect(
      computeEvidenceCompleteness(IncidentType.CLOUD_OUTAGE, [EvidenceSourceCategory.MONITORING]),
    ).toBe(50);
  });

  it('returns 0 when no required sources are present at all', () => {
    expect(
      computeEvidenceCompleteness(IncidentType.CLOUD_OUTAGE, [EvidenceSourceCategory.CHAT]),
    ).toBe(0);
  });

  it('returns 100 when all required sources are present', () => {
    expect(
      computeEvidenceCompleteness(IncidentType.CLOUD_OUTAGE, [
        EvidenceSourceCategory.MONITORING,
        EvidenceSourceCategory.CLOUD_PROVIDER,
      ]),
    ).toBe(100);
  });

  it('ignores duplicate and irrelevant categories', () => {
    expect(
      computeEvidenceCompleteness(IncidentType.CLOUD_OUTAGE, [
        EvidenceSourceCategory.MONITORING,
        EvidenceSourceCategory.MONITORING,
        EvidenceSourceCategory.CHAT,
      ]),
    ).toBe(50);
  });

  it('computes a 2-of-3 ratio for SECURITY_BREACH', () => {
    expect(
      computeEvidenceCompleteness(IncidentType.SECURITY_BREACH, [
        EvidenceSourceCategory.MONITORING,
        EvidenceSourceCategory.LOG_AGGREGATOR,
      ]),
    ).toBe(67);
  });
});
