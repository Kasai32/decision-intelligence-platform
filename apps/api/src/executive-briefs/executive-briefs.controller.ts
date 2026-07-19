import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { GenerateExecutiveBriefDto } from './dto/generate-executive-brief.dto';
import { ExecutiveBriefsService } from './executive-briefs.service';

@ApiTags('executive-briefs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidents/:incidentId')
export class ExecutiveBriefsController {
  constructor(private readonly executiveBriefs: ExecutiveBriefsService) {}

  @Post('executive-brief')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId') incidentId: string,
    @Body() dto: GenerateExecutiveBriefDto,
  ) {
    return this.executiveBriefs.generate(user.tenantId, incidentId, user.userId, dto);
  }

  @Get('executive-briefs')
  list(@CurrentUser() user: AuthenticatedUser, @Param('incidentId') incidentId: string) {
    return this.executiveBriefs.list(user.tenantId, incidentId);
  }
}
