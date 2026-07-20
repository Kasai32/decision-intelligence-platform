import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Decision,
  DecisionStatus,
  Incident,
  IncidentStatus,
  TimelineEventType,
} from '@prisma/client';
import { IntegrationsRegistryService } from '../integrations/integrations-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertValidTransition } from '../common/state-machine/state-machine';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto';
import { INCIDENT_TRANSITIONS } from './incident.state-machine';

export interface CommandCenterSummary {
  incident: Incident;
  openDecisions: Decision[];
  lastDecision: Decision | null;
}

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsRegistryService,
  ) {}

  async create(
    tenantId: string,
    createdByUserId: string,
    dto: CreateIncidentDto,
  ): Promise<Incident> {
    const incident = await this.prisma.incident.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        type: dto.type,
        createdByUserId,
      },
    });

    await this.prisma.timelineEvent.create({
      data: {
        tenantId,
        incidentId: incident.id,
        type: TimelineEventType.INCIDENT_CREATED,
        description: `Incident "${incident.title}" created`,
        actorUserId: createdByUserId,
      },
    });

    await this.integrations.broadcast('incidentCreated', {
      tenantId,
      incidentId: incident.id,
      summary: incident.title,
    });

    return incident;
  }

  findAll(tenantId: string): Promise<Incident[]> {
    return this.prisma.incident.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, tenantId },
      include: {
        decisions: { orderBy: { createdAt: 'desc' } },
        evidence: { orderBy: { createdAt: 'desc' } },
        actions: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }

  async getTimeline(tenantId: string, incidentId: string) {
    await this.getIncidentOrThrow(tenantId, incidentId);
    return this.prisma.timelineEvent.findMany({
      where: { tenantId, incidentId },
      orderBy: { occurredAt: 'asc' },
    });
  }

  async getDecisions(tenantId: string, incidentId: string): Promise<Decision[]> {
    await this.getIncidentOrThrow(tenantId, incidentId);
    return this.prisma.decision.findMany({
      where: { tenantId, incidentId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Shapes the Executive Command Center payload per ADR-0009 (amended by
   * ADR-0013): never a bare incident with no decision context — always
   * every currently open decision (an incident can genuinely have more
   * than one simultaneously, e.g. "isolate the network?" and "communicate
   * publicly?" during the same breach), otherwise the outcome of the last
   * decided one, or an explicit empty state if there's neither.
   */
  async getCommandCenterSummary(
    tenantId: string,
    incidentId: string,
  ): Promise<CommandCenterSummary> {
    const incident = await this.getIncidentOrThrow(tenantId, incidentId);

    const [openDecisions, lastDecision] = await Promise.all([
      this.prisma.decision.findMany({
        where: { tenantId, incidentId, status: DecisionStatus.OPEN },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.decision.findFirst({
        where: { tenantId, incidentId, status: DecisionStatus.DECIDED },
        orderBy: { decidedAt: 'desc' },
      }),
    ]);

    return { incident, openDecisions, lastDecision };
  }

  async updateStatus(
    tenantId: string,
    id: string,
    actorUserId: string,
    dto: UpdateIncidentStatusDto,
  ): Promise<Incident> {
    const incident = await this.getIncidentOrThrow(tenantId, id);
    assertValidTransition('Incident', INCIDENT_TRANSITIONS, incident.status, dto.status);

    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        status: dto.status,
        closedAt: dto.status === IncidentStatus.CLOSED ? new Date() : incident.closedAt,
      },
    });

    await this.prisma.timelineEvent.create({
      data: {
        tenantId,
        incidentId: id,
        type: TimelineEventType.INCIDENT_STATUS_CHANGED,
        description: `Status changed: ${incident.status} -> ${dto.status}`,
        actorUserId,
        metadata: { from: incident.status, to: dto.status },
      },
    });

    return updated;
  }

  private async getIncidentOrThrow(tenantId: string, id: string): Promise<Incident> {
    const incident = await this.prisma.incident.findFirst({ where: { id, tenantId } });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }
}
