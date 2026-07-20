'use client';

import type {
  AiDraftStatus,
  BusinessImpact,
  DecisionOption,
  IncidentSeverity,
  IntelligenceAnalysis,
  Risk,
  RiskLevel,
  SubmitIntelligenceAnalysisInput,
} from '@dip/shared';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select } from './ui/select';
import { Textarea } from './ui/textarea';
import { apiClient, ApiError } from '../lib/api-client';
import { streamSse } from '../lib/sse';

const RISK_LEVELS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
const SEVERITIES: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const EMPTY_RISK: Risk = { description: '', likelihood: 'MEDIUM', impact: 'MEDIUM' };
const EMPTY_OPTION: DecisionOption = { label: '', description: '' };

function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseCommaList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export interface IntelligenceAnalysisFormProps {
  incidentId: string;
  onCreated: (analysis: IntelligenceAnalysis) => void;
}

/**
 * Submits the qualitative half of the AI Output Contract (see ADR-0010) —
 * a human analyst today, a real LLM integration later (memory/context.md
 * open question). The four confidence dimensions and `evidenceUsed` are
 * always computed server-side and never collected here.
 */
export function IntelligenceAnalysisForm({ incidentId, onCreated }: IntelligenceAnalysisFormProps) {
  const [situationSummary, setSituationSummary] = useState('');
  const [impactLevel, setImpactLevel] = useState<IncidentSeverity>('MEDIUM');
  const [impactDescription, setImpactDescription] = useState('');
  const [affectedSystems, setAffectedSystems] = useState('');
  const [risks, setRisks] = useState<Risk[]>([]);
  const [conflictingInformation, setConflictingInformation] = useState('');
  const [recommended, setRecommended] = useState<DecisionOption>(EMPTY_OPTION);
  const [alternatives, setAlternatives] = useState<DecisionOption[]>([]);
  const [expectedConsequences, setExpectedConsequences] = useState('');
  const [immediateNextActions, setImmediateNextActions] = useState('');
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aiAvailable, setAiAvailable] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftingText, setDraftingText] = useState('');
  const [isAiDraft, setIsAiDraft] = useState(false);

  useEffect(() => {
    apiClient
      .get<AiDraftStatus>('/decision-intelligence/ai-status')
      .then((status) => setAiAvailable(status.available))
      .catch(() => setAiAvailable(false));
  }, []);

  function applyDraft(draft: SubmitIntelligenceAnalysisInput) {
    setSituationSummary(draft.situationSummary);
    setImpactLevel(draft.businessImpact.level);
    setImpactDescription(draft.businessImpact.description);
    setAffectedSystems(draft.businessImpact.affectedSystems.join(', '));
    setRisks(draft.criticalRisks);
    setConflictingInformation(draft.conflictingInformation.join('\n'));
    setRecommended(draft.recommendedDecision);
    setAlternatives(draft.alternativeDecisions);
    setExpectedConsequences(draft.expectedConsequences);
    setImmediateNextActions(draft.immediateNextActions.join('\n'));
    setExecutiveSummary(draft.executiveSummary);
    setIsAiDraft(true);
  }

  /**
   * Streams the draft live (see ADR-0020) instead of a single blocking
   * request — the model's raw output appears as it's generated, then the
   * final `result` event carries the same server-validated draft the
   * non-streaming endpoint would have returned. Falls back to the
   * non-streaming endpoint if the stream never produces a result (e.g. the
   * connection drops), so a flaky network doesn't just silently fail.
   */
  async function handleGenerateDraft() {
    setError(null);
    setDrafting(true);
    setDraftingText('');
    try {
      let gotResult = false;
      for await (const evt of streamSse(`/incidents/${incidentId}/analyze/draft/stream`)) {
        if (evt.event === 'error') {
          throw new ApiError(502, evt.data);
        }
        if (evt.event === 'result') {
          gotResult = true;
          applyDraft(JSON.parse(evt.data) as SubmitIntelligenceAnalysisInput);
          continue;
        }
        setDraftingText((current) => current + evt.data);
      }
      if (!gotResult) {
        throw new ApiError(502, 'The draft stream ended without a result.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate an AI draft');
    } finally {
      setDrafting(false);
      setDraftingText('');
    }
  }

  function updateRisk(index: number, patch: Partial<Risk>) {
    setRisks((current) => current.map((risk, i) => (i === index ? { ...risk, ...patch } : risk)));
  }

  function updateAlternative(index: number, patch: Partial<DecisionOption>) {
    setAlternatives((current) =>
      current.map((option, i) => (i === index ? { ...option, ...patch } : option)),
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const businessImpact: BusinessImpact = {
      level: impactLevel,
      description: impactDescription,
      affectedSystems: parseCommaList(affectedSystems),
    };

    const body: SubmitIntelligenceAnalysisInput = {
      situationSummary,
      businessImpact,
      criticalRisks: risks.filter((risk) => risk.description.trim().length > 0),
      conflictingInformation: parseLines(conflictingInformation),
      recommendedDecision: recommended,
      alternativeDecisions: alternatives.filter((option) => option.label.trim().length > 0),
      expectedConsequences,
      immediateNextActions: parseLines(immediateNextActions),
      executiveSummary,
    };

    setSubmitting(true);
    try {
      const analysis = await apiClient.post<IntelligenceAnalysis>(
        `/incidents/${incidentId}/analyze`,
        body,
      );
      onCreated(analysis);
      setSituationSummary('');
      setImpactDescription('');
      setAffectedSystems('');
      setRisks([]);
      setConflictingInformation('');
      setRecommended(EMPTY_OPTION);
      setAlternatives([]);
      setExpectedConsequences('');
      setImmediateNextActions('');
      setExecutiveSummary('');
      setIsAiDraft(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit analysis');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm">New intelligence analysis</CardTitle>
        {aiAvailable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={drafting}
            onClick={handleGenerateDraft}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {drafting ? 'Drafting…' : 'Draft with AI'}
          </Button>
        )}
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          {drafting && (
            <div
              aria-live="polite"
              aria-label="AI draft in progress"
              className="max-h-40 overflow-y-auto rounded-sm border border-primary/30 bg-muted/50 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground"
            >
              {draftingText || 'Reading incident evidence…'}
              <span className="animate-cursor-blink ml-0.5 inline-block h-3 w-1.5 bg-primary align-text-bottom" />
            </div>
          )}
          {isAiDraft && (
            <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
              This draft was generated by AI from the incident&apos;s real evidence — review and
              edit every field before submitting. Confidence dimensions are always computed
              separately and were never part of this draft.
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="situationSummary">Situation summary</Label>
            <Textarea
              id="situationSummary"
              required
              value={situationSummary}
              onChange={(e) => setSituationSummary(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="impactLevel">Business impact level</Label>
              <Select
                id="impactLevel"
                value={impactLevel}
                onChange={(e) => setImpactLevel(e.target.value as IncidentSeverity)}
              >
                {SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="impactDescription">Business impact description</Label>
              <Input
                id="impactDescription"
                required
                value={impactDescription}
                onChange={(e) => setImpactDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="affectedSystems">Affected systems (comma-separated)</Label>
            <Input
              id="affectedSystems"
              value={affectedSystems}
              onChange={(e) => setAffectedSystems(e.target.value)}
              placeholder="billing-api, payments-db"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Critical risks</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRisks((current) => [...current, { ...EMPTY_RISK }])}
              >
                <Plus className="h-3.5 w-3.5" />
                Add risk
              </Button>
            </div>
            {risks.map((risk, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_auto_auto_auto]"
              >
                <Input
                  aria-label="Risk description"
                  placeholder="Risk description"
                  value={risk.description}
                  onChange={(e) => updateRisk(index, { description: e.target.value })}
                />
                <Select
                  aria-label="Likelihood"
                  value={risk.likelihood}
                  onChange={(e) => updateRisk(index, { likelihood: e.target.value as RiskLevel })}
                >
                  {RISK_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      Likelihood: {level}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label="Impact"
                  value={risk.impact}
                  onChange={(e) => updateRisk(index, { impact: e.target.value as RiskLevel })}
                >
                  {RISK_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      Impact: {level}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove risk"
                  onClick={() => setRisks((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conflictingInformation">Conflicting information (one per line)</Label>
            <Textarea
              id="conflictingInformation"
              value={conflictingInformation}
              onChange={(e) => setConflictingInformation(e.target.value)}
            />
          </div>

          <div className="grid gap-2 rounded-md border border-border p-3">
            <Label>Recommended decision</Label>
            <Input
              aria-label="Recommended decision label"
              placeholder="Label"
              required
              value={recommended.label}
              onChange={(e) => setRecommended((current) => ({ ...current, label: e.target.value }))}
            />
            <Textarea
              aria-label="Recommended decision description"
              placeholder="Description"
              required
              value={recommended.description}
              onChange={(e) =>
                setRecommended((current) => ({ ...current, description: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Alternative decisions</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAlternatives((current) => [...current, { ...EMPTY_OPTION }])}
              >
                <Plus className="h-3.5 w-3.5" />
                Add alternative
              </Button>
            </div>
            {alternatives.map((option, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <Input
                  aria-label="Alternative label"
                  placeholder="Label"
                  value={option.label}
                  onChange={(e) => updateAlternative(index, { label: e.target.value })}
                />
                <Input
                  aria-label="Alternative description"
                  placeholder="Description"
                  value={option.description}
                  onChange={(e) => updateAlternative(index, { description: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove alternative"
                  onClick={() =>
                    setAlternatives((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expectedConsequences">Expected consequences</Label>
            <Textarea
              id="expectedConsequences"
              required
              value={expectedConsequences}
              onChange={(e) => setExpectedConsequences(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="immediateNextActions">Immediate next actions (one per line)</Label>
            <Textarea
              id="immediateNextActions"
              value={immediateNextActions}
              onChange={(e) => setImmediateNextActions(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="executiveSummary">Executive summary</Label>
            <Textarea
              id="executiveSummary"
              required
              value={executiveSummary}
              onChange={(e) => setExecutiveSummary(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit analysis'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
