import type {
  AiCertaintyBreakdown,
  DataFreshnessBreakdown,
  EvidenceCompletenessBreakdown,
  EvidenceSourceCategory,
  IntelligenceAnalysis,
  SourceReliabilityBreakdown,
} from '@dip/shared';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { ConfidenceMeter } from './ConfidenceMeter';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { EVIDENCE_SOURCE_CATEGORY_LABEL } from '../lib/evidence-source-category';
import { severityBadgeVariant } from '../lib/severity';

const RISK_VARIANT = { LOW: 'low', MEDIUM: 'medium', HIGH: 'critical' } as const;

function humanizeSources(categories: EvidenceSourceCategory[]): string {
  if (categories.length === 0) return 'none';
  return categories.map((c) => EVIDENCE_SOURCE_CATEGORY_LABEL[c]).join(', ');
}

/** Plain-language "show your work" trace for evidenceCompleteness — see ADR-0019. */
function EvidenceCompletenessExplanation({
  breakdown,
}: {
  breakdown: EvidenceCompletenessBreakdown;
}) {
  if (breakdown.requiredSources.length === 0) {
    return <p>This incident type has no required evidence sources, so completeness is 100%.</p>;
  }
  return (
    <p>
      {`${breakdown.presentRequiredSources.length} of ${breakdown.requiredSources.length} required sources present for this incident type — required: ${humanizeSources(breakdown.requiredSources)}. Present: ${humanizeSources(breakdown.presentRequiredSources)}. Missing: ${humanizeSources(breakdown.missingRequiredSources)}.`}
    </p>
  );
}

/** Plain-language "show your work" trace for sourceReliability — see ADR-0019. */
function SourceReliabilityExplanation({ breakdown }: { breakdown: SourceReliabilityBreakdown }) {
  if (breakdown.perEvidence.length === 0) {
    return <p>No evidence has been submitted yet, so reliability is 0%.</p>;
  }
  return (
    <div>
      <ul className="flex flex-col gap-0.5">
        {breakdown.perEvidence.map((item) => (
          <li key={item.evidenceId}>
            {item.source} ({EVIDENCE_SOURCE_CATEGORY_LABEL[item.sourceCategory]}):{' '}
            <strong>{item.reliability}%</strong>
          </li>
        ))}
      </ul>
      <p className="mt-1">Average of the above = {breakdown.score}%.</p>
    </div>
  );
}

/** Plain-language "show your work" trace for dataFreshness — see ADR-0019. */
function DataFreshnessExplanation({ breakdown }: { breakdown: DataFreshnessBreakdown }) {
  if (breakdown.mostRecentEvidenceId === null) {
    return <p>No evidence has been submitted yet, so freshness is 0%.</p>;
  }
  return (
    <p>
      Most recent evidence was submitted <strong>{breakdown.minutesSinceMostRecent} min</strong>{' '}
      before this analysis. At {breakdown.severity} severity, freshness drops{' '}
      {breakdown.degradationFactorPerMinute} point(s) per minute: 100 −{' '}
      {breakdown.minutesSinceMostRecent} × {breakdown.degradationFactorPerMinute} ={' '}
      {breakdown.score}%.
    </p>
  );
}

/** Plain-language "show your work" trace for aiCertainty — see ADR-0019. */
function AiCertaintyExplanation({ breakdown }: { breakdown: AiCertaintyBreakdown }) {
  return (
    <p>
      {breakdown.evidenceCount} evidence item(s) (+{breakdown.volumeContribution}, capped at 70) and{' '}
      {breakdown.uniqueSourceCategoryCount} distinct source type(s) (+
      {breakdown.diversityContribution} diversity bonus, capped at 20)
      {breakdown.conflictCount > 0
        ? `, minus ${breakdown.conflictPenalty} for ${breakdown.conflictCount} flagged conflict(s)`
        : ''}{' '}
      = {breakdown.score}%. This is a deterministic heuristic from countable evidence facts, not a
      trained model's confidence.
    </p>
  );
}

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
                explanation={
                  <EvidenceCompletenessExplanation
                    breakdown={analysis.confidenceBreakdown.evidenceCompleteness}
                  />
                }
              />
              <ConfidenceMeter
                label="Source reliability"
                value={analysis.sourceReliability}
                explanation={
                  <SourceReliabilityExplanation
                    breakdown={analysis.confidenceBreakdown.sourceReliability}
                  />
                }
              />
              <ConfidenceMeter
                label="Data freshness"
                value={analysis.dataFreshness}
                explanation={
                  <DataFreshnessExplanation
                    breakdown={analysis.confidenceBreakdown.dataFreshness}
                  />
                }
              />
              <ConfidenceMeter
                label="AI certainty"
                value={analysis.aiCertainty}
                explanation={
                  <AiCertaintyExplanation breakdown={analysis.confidenceBreakdown.aiCertainty} />
                }
              />
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
