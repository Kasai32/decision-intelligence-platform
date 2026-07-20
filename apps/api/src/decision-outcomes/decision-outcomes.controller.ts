import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { DecisionOutcomesService } from './decision-outcomes.service';
import { RecordDecisionOutcomeDto } from './dto/record-decision-outcome.dto';

@ApiTags('decision-outcomes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('decisions/:decisionId')
export class DecisionOutcomesController {
  constructor(private readonly decisionOutcomes: DecisionOutcomesService) {}

  @Post('outcome')
  record(
    @CurrentUser() user: AuthenticatedUser,
    @Param('decisionId') decisionId: string,
    @Body() dto: RecordDecisionOutcomeDto,
  ) {
    return this.decisionOutcomes.record(user.tenantId, decisionId, user.userId, dto);
  }

  @Get('outcome')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('decisionId') decisionId: string) {
    return this.decisionOutcomes.findOne(user.tenantId, decisionId);
  }
}
