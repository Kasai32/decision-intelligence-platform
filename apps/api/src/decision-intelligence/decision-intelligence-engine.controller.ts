import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { DecisionIntelligenceEngineService } from './decision-intelligence-engine.service';
import { SubmitIntelligenceAnalysisDto } from './dto/submit-intelligence-analysis.dto';

@ApiTags('decision-intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidents/:incidentId')
export class DecisionIntelligenceEngineController {
  constructor(private readonly engine: DecisionIntelligenceEngineService) {}

  @Post('analyze')
  analyze(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId') incidentId: string,
    @Body() dto: SubmitIntelligenceAnalysisDto,
  ) {
    return this.engine.analyze(user.tenantId, incidentId, user.userId, dto);
  }

  @Get('analyses')
  list(@CurrentUser() user: AuthenticatedUser, @Param('incidentId') incidentId: string) {
    return this.engine.list(user.tenantId, incidentId);
  }
}
