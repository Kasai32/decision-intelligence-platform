import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Incident, IncidentStatus, LessonLearned, TimelineEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonLearnedDto } from './dto/create-lesson-learned.dto';

@Injectable()
export class LessonsLearnedService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A retrospective before the incident is actually closed isn't a
   * retrospective — see ADR-0011.
   */
  async create(
    tenantId: string,
    incidentId: string,
    createdByUserId: string,
    dto: CreateLessonLearnedDto,
  ): Promise<LessonLearned> {
    const incident = await this.getIncidentOrThrow(tenantId, incidentId);
    if (incident.status !== IncidentStatus.CLOSED) {
      throw new BadRequestException(
        `Lessons learned can only be recorded for a CLOSED incident (current status: ${incident.status}).`,
      );
    }

    const lesson = await this.prisma.lessonLearned.create({
      data: {
        tenantId,
        incidentId,
        title: dto.title,
        whatHappened: dto.whatHappened,
        whatWentWell: dto.whatWentWell ?? [],
        whatToImprove: dto.whatToImprove ?? [],
        actionItems: dto.actionItems ?? [],
        tags: dto.tags ?? [],
        createdByUserId,
      },
    });

    await this.prisma.timelineEvent.create({
      data: {
        tenantId,
        incidentId,
        type: TimelineEventType.LESSON_LEARNED_CREATED,
        description: `Lesson learned recorded: "${dto.title}"`,
        actorUserId: createdByUserId,
        metadata: { lessonId: lesson.id },
      },
    });

    return lesson;
  }

  async list(tenantId: string, incidentId: string): Promise<LessonLearned[]> {
    await this.getIncidentOrThrow(tenantId, incidentId);
    return this.prisma.lessonLearned.findMany({
      where: { tenantId, incidentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Knowledge Base search (see ADR-0011): ILIKE + tag filter, tenant-scoped. */
  async search(tenantId: string, query?: string, tags?: string[]): Promise<LessonLearned[]> {
    return this.prisma.lessonLearned.findMany({
      where: {
        tenantId,
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { whatHappened: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(tags && tags.length > 0 ? { tags: { hasSome: tags } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getIncidentOrThrow(tenantId: string, id: string): Promise<Incident> {
    const incident = await this.prisma.incident.findFirst({ where: { id, tenantId } });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }
}
