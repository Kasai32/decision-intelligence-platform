'use client';

import type { CalibrationDimension, CalibrationReport } from '@dip/shared';
import { Gauge, Radar } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ConfidenceMeter } from '../../components/ConfidenceMeter';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { apiClient, ApiError } from '../../lib/api-client';
import { getAccessToken } from '../../lib/auth-storage';

const DIMENSION_LABEL: Record<CalibrationDimension, string> = {
  evidenceCompleteness: 'Evidence completeness',
  sourceReliability: 'Source reliability',
  dataFreshness: 'Data freshness',
  aiCertainty: 'AI certainty',
};

/**
 * The real, computed relationship between the Decision Intelligence
 * Engine's four confidence dimensions (ADR-0010) and human-attested
 * decision outcomes (ADR-0016) — never fabricated. Below
 * `minimumSampleSizeThreshold`, a dimension is shown as "not enough data
 * yet" rather than a misleadingly precise number from a tiny sample.
 */
export default function CalibrationPage() {
  const [report, setReport] = useState<CalibrationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) return;
    apiClient
      .get<CalibrationReport>('/decision-intelligence/calibration-report')
      .then(setReport)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load calibration report'));
  }, []);

  if (!getAccessToken()) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Calibration</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">You need to sign in to view the calibration report.</p>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Calibration</h1>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <Radar className="h-4 w-4" />
            Command Center
          </Link>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Compares each Decision Intelligence confidence dimension against real, human-recorded decision outcomes
        (record one from a closed incident&apos;s Reports tab). This is a real, computed statistic — not a trained
        model — and is shown as &quot;not enough data yet&quot; rather than a falsely precise number when the
        sample is too small.
      </p>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {report === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex items-center justify-between pt-6 text-sm">
              <span className="text-muted-foreground">Total labeled outcomes (GOOD/BAD, with an analysis)</span>
              <span className="font-medium text-foreground">{report.totalLabeledOutcomes}</span>
            </CardContent>
          </Card>

          {report.dimensions.map((dimension) => (
            <Card key={dimension.dimension}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  {DIMENSION_LABEL[dimension.dimension]}
                  {!dimension.sufficientData && (
                    <Badge variant="outline">
                      Not enough data yet ({dimension.goodSampleSize + dimension.badSampleSize} of{' '}
                      {report.minimumSampleSizeThreshold})
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {dimension.meanWhenGood !== null ? (
                  <ConfidenceMeter
                    label={`Mean when outcome was GOOD (n=${dimension.goodSampleSize})`}
                    value={dimension.meanWhenGood}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">No GOOD-outcome samples recorded yet.</p>
                )}
                {dimension.meanWhenBad !== null ? (
                  <ConfidenceMeter
                    label={`Mean when outcome was BAD (n=${dimension.badSampleSize})`}
                    value={dimension.meanWhenBad}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">No BAD-outcome samples recorded yet.</p>
                )}
                {dimension.sufficientData && dimension.meanDifference !== null && (
                  <p className="text-xs text-muted-foreground">
                    Difference: {dimension.meanDifference > 0 ? '+' : ''}
                    {dimension.meanDifference.toFixed(1)} — positive means higher scores here are associated with
                    GOOD outcomes so far.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
