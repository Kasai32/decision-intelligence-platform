import { Injectable } from '@nestjs/common';
import { DecisionOutcomeQuality } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Minimum combined GOOD+BAD sample size before a dimension's statistics are
 * reported as meaningful. A disclosed placeholder (see ADR-0016) — not
 * derived from a real power analysis, since no real effect size estimate
 * exists yet either. Small enough to be reachable in this environment
 * without a large historical corpus; revisit once real usage data exists.
 */
export const MIN_SAMPLE_SIZE = 5;

const DIMENSIONS = [
  'evidenceCompleteness',
  'sourceReliability',
  'dataFreshness',
  'aiCertainty',
] as const;
export type CalibrationDimension = (typeof DIMENSIONS)[number];

export interface DimensionCalibration {
  dimension: CalibrationDimension;
  goodSampleSize: number;
  badSampleSize: number;
  meanWhenGood: number | null;
  meanWhenBad: number | null;
  /** meanWhenGood - meanWhenBad. Positive means higher scores on this dimension are associated with GOOD outcomes. */
  meanDifference: number | null;
  sufficientData: boolean;
}

export interface CalibrationReport {
  totalLabeledOutcomes: number;
  minimumSampleSizeThreshold: number;
  dimensions: DimensionCalibration[];
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Computes the real, empirical relationship between the Decision
 * Intelligence Engine's four confidence dimensions (ADR-0010) and what
 * actually happened, from human-attested DecisionOutcome records (ADR-0016)
 * — never fabricated, and explicitly marked `sufficientData: false` rather
 * than reporting a misleadingly precise number from a tiny sample.
 */
@Injectable()
export class CalibrationService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(tenantId: string): Promise<CalibrationReport> {
    const outcomes = await this.prisma.decisionOutcome.findMany({
      where: {
        tenantId,
        intelligenceAnalysisId: { not: null },
        outcomeQuality: { in: [DecisionOutcomeQuality.GOOD, DecisionOutcomeQuality.BAD] },
      },
      include: { intelligenceAnalysis: true },
    });

    const dimensions = DIMENSIONS.map((dimension): DimensionCalibration => {
      const goodValues: number[] = [];
      const badValues: number[] = [];
      for (const outcome of outcomes) {
        if (!outcome.intelligenceAnalysis) continue;
        const value = outcome.intelligenceAnalysis[dimension];
        if (outcome.outcomeQuality === DecisionOutcomeQuality.GOOD) {
          goodValues.push(value);
        } else {
          badValues.push(value);
        }
      }

      const meanWhenGood = mean(goodValues);
      const meanWhenBad = mean(badValues);

      return {
        dimension,
        goodSampleSize: goodValues.length,
        badSampleSize: badValues.length,
        meanWhenGood,
        meanWhenBad,
        meanDifference:
          meanWhenGood !== null && meanWhenBad !== null ? meanWhenGood - meanWhenBad : null,
        sufficientData: goodValues.length + badValues.length >= MIN_SAMPLE_SIZE,
      };
    });

    return {
      totalLabeledOutcomes: outcomes.length,
      minimumSampleSizeThreshold: MIN_SAMPLE_SIZE,
      dimensions,
    };
  }
}
