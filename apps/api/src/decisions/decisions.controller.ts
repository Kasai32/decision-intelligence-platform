import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { DecideDecisionDto } from './dto/decide-decision.dto';
import { OpenDecisionDto } from './dto/open-decision.dto';
import { DecisionsService } from './decisions.service';

@ApiTags('decisions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('decisions')
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Post()
  open(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenDecisionDto) {
    return this.decisionsService.open(user.tenantId, user.userId, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.decisionsService.findOne(user.tenantId, id);
  }

  @Post(':id/decide')
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DecideDecisionDto,
  ) {
    return this.decisionsService.decide(user.tenantId, user.userId, id, dto);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.decisionsService.cancel(user.tenantId, user.userId, id);
  }
}
