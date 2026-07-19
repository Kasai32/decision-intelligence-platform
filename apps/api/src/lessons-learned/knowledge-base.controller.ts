import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { SearchKnowledgeBaseDto } from './dto/search-knowledge-base.dto';
import { LessonsLearnedService } from './lessons-learned.service';

@ApiTags('knowledge-base')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(private readonly lessonsLearned: LessonsLearnedService) {}

  @Get('search')
  search(@CurrentUser() user: AuthenticatedUser, @Query() dto: SearchKnowledgeBaseDto) {
    const tags = dto.tags
      ?.split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    return this.lessonsLearned.search(user.tenantId, dto.query, tags);
  }
}
