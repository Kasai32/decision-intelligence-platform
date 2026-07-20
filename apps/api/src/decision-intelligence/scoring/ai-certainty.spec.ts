import { computeAiCertainty, explainAiCertainty } from './ai-certainty';

describe('computeAiCertainty — deterministic heuristic (see ADR-0010)', () => {
  it('returns 0 with no evidence, no diversity, no conflicts', () => {
    expect(computeAiCertainty(0, 0, 0)).toBe(0);
  });

  it('increases with more evidence volume, up to the cap', () => {
    expect(computeAiCertainty(1, 0, 0)).toBe(15);
    expect(computeAiCertainty(3, 0, 0)).toBe(45);
    expect(computeAiCertainty(10, 0, 0)).toBe(70); // capped at 70
  });

  it('rewards source diversity in addition to raw volume, up to the cap', () => {
    const noDiversity = computeAiCertainty(2, 1, 0);
    const withDiversity = computeAiCertainty(2, 3, 0);
    expect(withDiversity).toBeGreaterThan(noDiversity);
    expect(computeAiCertainty(0, 10, 0)).toBe(20); // diversity alone capped at 20
  });

  it('penalizes flagged conflicts', () => {
    const withoutConflict = computeAiCertainty(4, 2, 0);
    const withConflict = computeAiCertainty(4, 2, 1);
    expect(withConflict).toBeLessThan(withoutConflict);
    expect(withoutConflict - withConflict).toBe(15);
  });

  it('never goes below 0 even with many conflicts', () => {
    expect(computeAiCertainty(1, 1, 10)).toBe(0);
  });

  it('never exceeds 100', () => {
    expect(computeAiCertainty(100, 100, 0)).toBe(90); // 70 + 20, still capped well under 100
  });
});

describe('explainAiCertainty', () => {
  it('breaks the score down into its three named contributions, matching computeAiCertainty exactly', () => {
    const breakdown = explainAiCertainty(4, 2, 1);

    expect(breakdown.score).toBe(computeAiCertainty(4, 2, 1));
    expect(breakdown.evidenceCount).toBe(4);
    expect(breakdown.uniqueSourceCategoryCount).toBe(2);
    expect(breakdown.conflictCount).toBe(1);
    expect(breakdown.volumeContribution).toBe(60); // 4 * 15
    expect(breakdown.diversityContribution).toBe(14); // 2 * 7
    expect(breakdown.conflictPenalty).toBe(15); // 1 * 15
  });

  it('reports the volume/diversity caps in the breakdown, not just the raw multiplication', () => {
    const breakdown = explainAiCertainty(10, 10, 0);
    expect(breakdown.volumeContribution).toBe(70); // capped, not 150
    expect(breakdown.diversityContribution).toBe(20); // capped, not 70
  });
});
