import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmClient } from '../../common/llm/llm-client.interface';
import { AiDraftService } from './ai-draft.service';

const VALID_DRAFT_JSON = JSON.stringify({
  situationSummary: 'Payments API returning elevated 5xx rates.',
  businessImpact: {
    level: 'HIGH',
    description: 'Checkout failures for a subset of customers.',
    affectedSystems: ['payments-api'],
  },
  criticalRisks: [{ description: 'Revenue loss', likelihood: 'HIGH', impact: 'HIGH' }],
  conflictingInformation: [],
  recommendedDecision: { label: 'Roll back', description: 'Roll back the 11:35 deploy.' },
  alternativeDecisions: [],
  expectedConsequences: 'Brief additional downtime, then recovery.',
  immediateNextActions: ['Page on-call'],
  executiveSummary: 'Recommend rollback.',
});

describe('AiDraftService', () => {
  let prisma: { incident: { findFirst: jest.Mock }; evidence: { findMany: jest.Mock } };
  let llm: { available: boolean; generateText: jest.Mock };
  let service: AiDraftService;

  beforeEach(() => {
    prisma = {
      incident: { findFirst: jest.fn() },
      evidence: { findMany: jest.fn() },
    };
    llm = { available: true, generateText: jest.fn() };
    service = new AiDraftService(prisma as unknown as PrismaService, llm as unknown as LlmClient);
  });

  it('exposes the underlying LlmClient.available flag', () => {
    expect(service.available).toBe(true);
    llm.available = false;
    expect(service.available).toBe(false);
  });

  it('throws NotFoundException for an incident outside the tenant', async () => {
    prisma.incident.findFirst.mockResolvedValue(null);

    await expect(service.generateDraft('t1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(llm.generateText).not.toHaveBeenCalled();
  });

  it('builds a prompt from the real incident and evidence, and returns a validated draft', async () => {
    prisma.incident.findFirst.mockResolvedValue({
      id: 'i1',
      tenantId: 't1',
      title: 'Payments outage',
      type: 'CLOUD_OUTAGE',
      severity: 'HIGH',
      status: 'OPEN',
      description: 'Checkout returning 500s',
    });
    prisma.evidence.findMany.mockResolvedValue([
      {
        sourceCategory: 'MONITORING',
        type: 'METRIC',
        source: 'Datadog',
        createdAt: new Date('2026-07-20T11:40:00Z'),
        summary: 'Error rate spiked to 42%',
      },
    ]);
    llm.generateText.mockResolvedValue(VALID_DRAFT_JSON);

    const draft = await service.generateDraft('t1', 'i1');

    expect(draft.situationSummary).toBe('Payments API returning elevated 5xx rates.');
    expect(draft.recommendedDecision.label).toBe('Roll back');

    const [{ system, user }] = llm.generateText.mock.calls[0];
    expect(system).toContain('DATA submitted by users and integrations');
    expect(user).toContain('Payments outage');
    expect(user).toContain('Datadog');
  });

  it('rejects a draft that is not valid JSON', async () => {
    prisma.incident.findFirst.mockResolvedValue({ id: 'i1', tenantId: 't1' });
    prisma.evidence.findMany.mockResolvedValue([]);
    llm.generateText.mockResolvedValue('not json at all');

    await expect(service.generateDraft('t1', 'i1')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it("rejects a draft whose JSON doesn't match SubmitIntelligenceAnalysisDto's shape", async () => {
    prisma.incident.findFirst.mockResolvedValue({ id: 'i1', tenantId: 't1' });
    prisma.evidence.findMany.mockResolvedValue([]);
    llm.generateText.mockResolvedValue(JSON.stringify({ situationSummary: 'only this field' }));

    await expect(service.generateDraft('t1', 'i1')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('rejects a draft that tries to self-report a confidence/certainty field, rather than trusting or silently stripping it', async () => {
    prisma.incident.findFirst.mockResolvedValue({ id: 'i1', tenantId: 't1' });
    prisma.evidence.findMany.mockResolvedValue([]);
    const withFabricatedConfidence = JSON.stringify({
      ...JSON.parse(VALID_DRAFT_JSON),
      aiCertainty: 97,
      confidence: 'very high',
    });
    llm.generateText.mockResolvedValue(withFabricatedConfidence);

    await expect(service.generateDraft('t1', 'i1')).rejects.toBeInstanceOf(BadGatewayException);
  });
});
