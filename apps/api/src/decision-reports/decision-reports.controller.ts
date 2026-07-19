import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { DecisionReportsService } from './decision-reports.service';
import { GenerateDecisionReportDto } from './dto/generate-decision-report.dto';

@ApiTags('decision-reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('decisions/:decisionId')
export class DecisionReportsController {
  constructor(private readonly decisionReports: DecisionReportsService) {}

  @Post('report')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('decisionId') decisionId: string,
    @Body() dto: GenerateDecisionReportDto,
  ) {
    return this.decisionReports.generate(user.tenantId, decisionId, user.userId, dto);
  }

  @Get('reports')
  list(@CurrentUser() user: AuthenticatedUser, @Param('decisionId') decisionId: string) {
    return this.decisionReports.list(user.tenantId, decisionId);
  }
}
