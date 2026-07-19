import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EvidenceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceService } from './evidence.service';

describe('EvidenceService', () => {
  let prisma: {
    incident: { findFirst: jest.Mock };
    decision: { findFirst: jest.Mock };
    evidence: { create: jest.Mock; findFirst: jest.Mock };
    timelineEvent: { create: jest.Mock };
  };
  let service: EvidenceService;

  beforeEach(() => {
    prisma = {
      incident: { findFirst: jest.fn() },
      decision: { findFirst: jest.fn() },
      evidence: { create: jest.fn(), findFirst: jest.fn() },
      timelineEvent: { create: jest.fn() },
    };
    service = new EvidenceService(prisma as unknown as PrismaService);
  });

  it('rejects evidence for an incident outside the tenant', async () => {
    prisma.incident.findFirst.mockResolvedValue(null);
    await expect(
      service.create('t1', 'u1', {
        incidentId: 'missing',
        type: EvidenceType.LOG,
        source: 'manual',
        summary: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a decisionId that does not belong to the given incident', async () => {
    prisma.incident.findFirst.mockResolvedValue({ id: 'i1' });
    prisma.decision.findFirst.mockResolvedValue(null);

    await expect(
      service.create('t1', 'u1', {
        incidentId: 'i1',
        decisionId: 'd-from-another-incident',
        type: EvidenceType.LOG,
        source: 'manual',
        summary: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates evidence and a timeline event when valid', async () => {
    prisma.incident.findFirst.mockResolvedValue({ id: 'i1' });
    prisma.evidence.create.mockResolvedValue({ id: 'e1' });
    prisma.timelineEvent.create.mockResolvedValue({});

    const result = await service.create('t1', 'u1', {
      incidentId: 'i1',
      type: EvidenceType.METRIC,
      source: 'Datadog',
      summary: 'CPU spike at 14:00',
    });

    expect(result.id).toBe('e1');
    expect(prisma.timelineEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'EVIDENCE_ADDED' }) }),
    );
  });
});
