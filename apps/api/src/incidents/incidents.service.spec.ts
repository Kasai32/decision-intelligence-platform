import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IncidentStatus } from '@prisma/client';
import { IntegrationsRegistryService } from '../integrations/integrations-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsService } from './incidents.service';

describe('IncidentsService', () => {
  let prisma: {
    incident: { create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    timelineEvent: { create: jest.Mock; findMany: jest.Mock };
    decision: { findFirst: jest.Mock };
  };
  let integrations: { broadcast: jest.Mock };
  let service: IncidentsService;

  beforeEach(() => {
    prisma = {
      incident: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      timelineEvent: { create: jest.fn(), findMany: jest.fn() },
      decision: { findFirst: jest.fn() },
    };
    integrations = { broadcast: jest.fn().mockResolvedValue(undefined) };
    service = new IncidentsService(
      prisma as unknown as PrismaService,
      integrations as unknown as IntegrationsRegistryService,
    );
  });

  describe('create', () => {
    it('creates the incident, writes a timeline event, and broadcasts to integrations', async () => {
      prisma.incident.create.mockResolvedValue({ id: 'i1', title: 'Outage', tenantId: 't1' });
      prisma.timelineEvent.create.mockResolvedValue({});

      const result = await service.create('t1', 'u1', { title: 'Outage', description: 'desc' });

      expect(result.id).toBe('i1');
      expect(prisma.timelineEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'INCIDENT_CREATED', incidentId: 'i1' }),
        }),
      );
      expect(integrations.broadcast).toHaveBeenCalledWith(
        'incidentCreated',
        expect.objectContaining({ incidentId: 'i1', tenantId: 't1' }),
      );
    });
  });

  describe('updateStatus', () => {
    it('allows a legal forward transition', async () => {
      prisma.incident.findFirst.mockResolvedValue({ id: 'i1', status: IncidentStatus.OPEN });
      prisma.incident.update.mockResolvedValue({ id: 'i1', status: IncidentStatus.MITIGATED });
      prisma.timelineEvent.create.mockResolvedValue({});

      const result = await service.updateStatus('t1', 'i1', 'u1', {
        status: IncidentStatus.MITIGATED,
      });
      expect(result.status).toBe(IncidentStatus.MITIGATED);
    });

    it('rejects a state jump (OPEN straight to CLOSED)', async () => {
      prisma.incident.findFirst.mockResolvedValue({ id: 'i1', status: IncidentStatus.OPEN });

      await expect(
        service.updateStatus('t1', 'i1', 'u1', { status: IncidentStatus.CLOSED }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.incident.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an incident outside the tenant', async () => {
      prisma.incident.findFirst.mockResolvedValue(null);
      await expect(
        service.updateStatus('t1', 'missing', 'u1', { status: IncidentStatus.MITIGATED }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getCommandCenterSummary', () => {
    it('returns the open decision when one exists', async () => {
      prisma.incident.findFirst.mockResolvedValue({ id: 'i1' });
      prisma.decision.findFirst
        .mockResolvedValueOnce({ id: 'd1', status: 'OPEN' })
        .mockResolvedValueOnce(null);

      const summary = await service.getCommandCenterSummary('t1', 'i1');
      expect(summary.openDecision).toEqual({ id: 'd1', status: 'OPEN' });
    });

    it('falls back to the last decided decision when there is no open one', async () => {
      prisma.incident.findFirst.mockResolvedValue({ id: 'i1' });
      prisma.decision.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'd2', status: 'DECIDED' });

      const summary = await service.getCommandCenterSummary('t1', 'i1');
      expect(summary.openDecision).toBeNull();
      expect(summary.lastDecision).toEqual({ id: 'd2', status: 'DECIDED' });
    });

    it('returns both null when the incident has no decisions at all (frontend renders an explicit empty state, never blank)', async () => {
      prisma.incident.findFirst.mockResolvedValue({ id: 'i1' });
      prisma.decision.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const summary = await service.getCommandCenterSummary('t1', 'i1');
      expect(summary.openDecision).toBeNull();
      expect(summary.lastDecision).toBeNull();
    });
  });
});
