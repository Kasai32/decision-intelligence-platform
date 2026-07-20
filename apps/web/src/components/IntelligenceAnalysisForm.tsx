'use client';

import type {
  BusinessImpact,
  DecisionOption,
  IncidentSeverity,
  IntelligenceAnalysis,
  Risk,
  RiskLevel,
  SubmitIntelligenceAnalysisInput,
} from '@dip/shared';
import { Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select } from './ui/select';
import { Textarea } from './ui/textarea';
import { apiClient, ApiError } from '../lib/api-client';

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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit analysis');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">New intelligence analysis</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
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
