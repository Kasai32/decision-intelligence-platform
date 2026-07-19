import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Action, ActionStatus, TimelineEventType } from '@prisma/client';
import { assertValidTransition } from '../common/state-machine/state-machine';
import { PrismaService } from '../prisma/prisma.service';
import { ACTION_TRANSITIONS } from './action.state-machine';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionStatusDto } from './dto/update-action-status.dto';

@Injectable()
export class ActionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, actorUserId: string, dto: CreateActionDto): Promise<Action> {
    const incident = await this.prisma.incident.findFirst({
      where: { id: dto.incidentId, tenantId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    if (dto.assignedToUserId) {
      const membership = await this.prisma.membership.findUnique({
        where: { userId_tenantId: { userId: dto.assignedToUserId, tenantId } },
      });
      if (!membership) {
        throw new BadRequestException('assignedToUserId must be a member of this tenant');
      }
    }

    const action = await this.prisma.action.create({
      data: {
        tenantId,
        incidentId: dto.incidentId,
        decisionId: dto.decisionId,
        title: dto.title,
        assignedToUserId: dto.assignedToUserId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      },
    });

    await this.prisma.timelineEvent.create({
      data: {
        tenantId,
        incidentId: dto.incidentId,
        decisionId: dto.decisionId,
        type: TimelineEventType.ACTION_CREATED,
        description: `Action created: "${dto.title}"`,
        actorUserId,
      },
    });

    return action;
  }

  async updateStatus(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateActionStatusDto,
  ): Promise<Action> {
    const action = await this.getActionOrThrow(tenantId, id);
    assertValidTransition('Action', ACTION_TRANSITIONS, action.status, dto.status);

    const updated = await this.prisma.action.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt: dto.status === ActionStatus.DONE ? new Date() : action.completedAt,
      },
    });

    await this.prisma.timelineEvent.create({
      data: {
        tenantId,
        incidentId: action.incidentId,
        decisionId: action.decisionId,
        type: TimelineEventType.ACTION_STATUS_CHANGED,
        description: `Action status changed: ${action.status} -> ${dto.status}`,
        actorUserId,
        metadata: { from: action.status, to: dto.status },
      },
    });

    return updated;
  }

  private async getActionOrThrow(tenantId: string, id: string): Promise<Action> {
    const action = await this.prisma.action.findFirst({ where: { id, tenantId } });
    if (!action) {
      throw new NotFoundException('Action not found');
    }
    return action;
  }
}
