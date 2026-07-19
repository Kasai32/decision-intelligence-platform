import { EvidenceSourceCategory } from '@prisma/client';
import { computeSourceReliability } from './source-reliability';

describe('computeSourceReliability', () => {
  it('returns 0 for no evidence — an honest absence, not a fabricated default', () => {
    expect(computeSourceReliability([])).toBe(0);
  });

  it('returns the exact reliability for a single source (CloudTrail-like)', () => {
    expect(computeSourceReliability([EvidenceSourceCategory.CLOUD_PROVIDER])).toBe(95);
  });

  it('returns the exact reliability for a single unreliable source (unverified chat)', () => {
    expect(computeSourceReliability([EvidenceSourceCategory.CHAT])).toBe(40);
  });

  it('averages reliability across mixed sources (sum / count, per ADR-0010)', () => {
    expect(
      computeSourceReliability([
        EvidenceSourceCategory.CLOUD_PROVIDER,
        EvidenceSourceCategory.CHAT,
      ]),
    ).toBe(68); // (95 + 40) / 2 = 67.5, rounded to 68
  });

  it('weighs each piece of evidence individually, not per distinct category', () => {
    expect(
      computeSourceReliability([
        EvidenceSourceCategory.CLOUD_PROVIDER,
        EvidenceSourceCategory.CLOUD_PROVIDER,
        EvidenceSourceCategory.CHAT,
      ]),
    ).toBe(77); // (95 + 95 + 40) / 3 = 76.67, rounded to 77
  });
});
