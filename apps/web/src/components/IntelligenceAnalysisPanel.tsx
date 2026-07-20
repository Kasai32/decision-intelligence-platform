import type { IntelligenceAnalysis } from '@dip/shared';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { ConfidenceMeter } from './ConfidenceMeter';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { severityBadgeVariant } from '../lib/severity';

const RISK_VARIANT = { LOW: 'low', MEDIUM: 'medium', HIGH: 'critical' } as const;

export interface IntelligenceAnalysisPanelProps {
  analyses: IntelligenceAnalysis[];
}

/**
 * Read-only history of Decision Intelligence analyses for an incident (see
 * ADR-0010 — Phase 4). Every analysis is rendered in full: the four
 * confidence dimensions stay separate bars (never merged into one score),
 * and `missingInformation` is always shown, even when non-empty, per
 * Principle 3 ("never hidden by omission").
 */
export function IntelligenceAnalysisPanel({ analyses }: IntelligenceAnalysisPanelProps) {
  if (analyses.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            No intelligence analysis recorded yet for this incident
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {analyses.map((analysis) => (
        <Card key={analysis.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-low" />
              Analysis — {new Date(analysis.createdAt).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ConfidenceMeter
                label="Evidence completeness"
                value={analysis.evidenceCompleteness}
              />
              <ConfidenceMeter label="Source reliability" value={analysis.sourceReliability} />
              <ConfidenceMeter label="Data freshness" value={analysis.dataFreshness} />
              <ConfidenceMeter label="AI certainty" value={analysis.aiCertainty} />
            </div>

            <p className="text-sm font-medium text-foreground">{analysis.executiveSummary}</p>

            {analysis.missingInformation.length > 0 && (
              <div className="flex flex-col gap-1 rounded-md border border-medium/30 bg-medium/10 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-medium">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Missing information
                </p>
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {analysis.missingInformation.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            <div>
              <p className="text-xs font-medium text-muted-foreground">Situation</p>
              <p className="text-sm text-foreground">{analysis.situationSummary}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">Business impact</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={severityBadgeVariant(analysis.businessImpact.level)}>
                  {analysis.businessImpact.level}
                </Badge>
                <p className="text-sm text-foreground">{analysis.businessImpact.description}</p>
              </div>
              {analysis.businessImpact.affectedSystems.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {analysis.businessImpact.affectedSystems.map((system) => (
                    <Badge key={system} variant="outline">
                      {system}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {analysis.criticalRisks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Critical risks</p>
                <ul className="mt-1 flex flex-col gap-1.5">
                  {analysis.criticalRisks.map((risk) => (
                    <li
                      key={risk.description}
                      className="flex items-center gap-2 text-sm text-foreground"
                    >
                      <Badge variant={RISK_VARIANT[risk.likelihood]}>L:{risk.likelihood}</Badge>
                      <Badge variant={RISK_VARIANT[risk.impact]}>I:{risk.impact}</Badge>
                      {risk.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.conflictingInformation.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Conflicting information</p>
                <ul className="mt-1 list-inside list-disc text-sm text-foreground">
                  {analysis.conflictingInformation.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            <div>
              <p className="text-xs font-medium text-muted-foreground">Recommended decision</p>
              <p className="text-sm font-medium text-foreground">
                {analysis.recommendedDecision.label}
              </p>
              <p className="text-sm text-muted-foreground">
                {analysis.recommendedDecision.description}
              </p>
            </div>

            {analysis.alternativeDecisions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Alternatives considered</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {analysis.alternativeDecisions.map((option) => (
                    <li key={option.label} className="text-sm text-foreground">
                      <span className="font-medium">{option.label}</span> — {option.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-muted-foreground">Expected consequences</p>
              <p className="text-sm text-foreground">{analysis.expectedConsequences}</p>
            </div>

            {analysis.immediateNextActions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Immediate next actions</p>
                <ul className="mt-1 list-inside list-disc text-sm text-foreground">
                  {analysis.immediateNextActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
