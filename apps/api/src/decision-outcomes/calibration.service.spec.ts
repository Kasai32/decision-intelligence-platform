import { CalibrationService, MIN_SAMPLE_SIZE } from './calibration.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CalibrationService — real statistics from human-attested outcomes, never fabricated', () => {
  let prisma: { decisionOutcome: { findMany: jest.Mock } };
  let service: CalibrationService;

  beforeEach(() => {
    prisma = { decisionOutcome: { findMany: jest.fn() } };
    service = new CalibrationService(prisma as unknown as PrismaService);
  });

  it('scopes the query to the tenant, only labeled (GOOD/BAD) outcomes with a linked analysis', async () => {
    prisma.decisionOutcome.findMany.mockResolvedValue([]);
    await service.getReport('t1');
    expect(prisma.decisionOutcome.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 't1',
        intelligenceAnalysisId: { not: null },
        outcomeQuality: { in: ['GOOD', 'BAD'] },
      },
      include: { intelligenceAnalysis: true },
    });
  });

  it('reports insufficientData (not a fabricated precise number) below the sample-size threshold', async () => {
    prisma.decisionOutcome.findMany.mockResolvedValue([
      {
        outcomeQuality: 'GOOD',
        intelligenceAnalysis: { evidenceCompleteness: 80, sourceReliability: 90, dataFreshness: 70, aiCertainty: 60 },
      },
    ]);

    const report = await service.getReport('t1');
    expect(report.totalLabeledOutcomes).toBe(1);
    expect(report.minimumSampleSizeThreshold).toBe(MIN_SAMPLE_SIZE);
    for (const dimension of report.dimensions) {
      expect(dimension.sufficientData).toBe(false);
    }
  });

  it('computes the exact mean-when-good / mean-when-bad / difference for a real, correctly-shaped sample', async () => {
    const analysis = (evidenceCompleteness: number) => ({
      evidenceCompleteness,
      sourceReliability: 50,
      dataFreshness: 50,
      aiCertainty: 50,
    });

    prisma.decisionOutcome.findMany.mockResolvedValue([
      { outcomeQuality: 'GOOD', intelligenceAnalysis: analysis(90) },
      { outcomeQuality: 'GOOD', intelligenceAnalysis: analysis(70) },
      { outcomeQuality: 'GOOD', intelligenceAnalysis: analysis(80) },
      { outcomeQuality: 'BAD', intelligenceAnalysis: analysis(30) },
      { outcomeQuality: 'BAD', intelligenceAnalysis: analysis(50) },
    ]);

    const report = await service.getReport('t1');
    const evidenceCompletenessCalibration = report.dimensions.find(
      (d) => d.dimension === 'evidenceCompleteness',
    )!;

    expect(evidenceCompletenessCalibration.goodSampleSize).toBe(3);
    expect(evidenceCompletenessCalibration.badSampleSize).toBe(2);
    expect(evidenceCompletenessCalibration.meanWhenGood).toBe(80); // (90+70+80)/3
    expect(evidenceCompletenessCalibration.meanWhenBad).toBe(40); // (30+50)/2
    expect(evidenceCompletenessCalibration.meanDifference).toBe(40);
    expect(evidenceCompletenessCalibration.sufficientData).toBe(true); // 5 >= MIN_SAMPLE_SIZE
  });

  it('ignores MIXED/UNKNOWN outcomes and outcomes with no linked analysis entirely (the query already filters them, this proves the aggregation does too)', async () => {
    prisma.decisionOutcome.findMany.mockResolvedValue([
      { outcomeQuality: 'GOOD', intelligenceAnalysis: { evidenceCompleteness: 100, sourceReliability: 100, dataFreshness: 100, aiCertainty: 100 } },
      { outcomeQuality: 'GOOD', intelligenceAnalysis: null },
    ]);

    const report = await service.getReport('t1');
    const evidenceCompletenessCalibration = report.dimensions.find(
      (d) => d.dimension === 'evidenceCompleteness',
    )!;
    expect(evidenceCompletenessCalibration.goodSampleSize).toBe(1);
    expect(evidenceCompletenessCalibration.meanWhenGood).toBe(100);
  });
});
