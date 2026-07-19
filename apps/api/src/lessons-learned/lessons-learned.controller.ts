import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { CreateLessonLearnedDto } from './dto/create-lesson-learned.dto';
import { LessonsLearnedService } from './lessons-learned.service';

@ApiTags('lessons-learned')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidents/:incidentId/lessons-learned')
export class LessonsLearnedController {
  constructor(private readonly lessonsLearned: LessonsLearnedService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId') incidentId: string,
    @Body() dto: CreateLessonLearnedDto,
  ) {
    return this.lessonsLearned.create(user.tenantId, incidentId, user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param('incidentId') incidentId: string) {
    return this.lessonsLearned.list(user.tenantId, incidentId);
  }
}
