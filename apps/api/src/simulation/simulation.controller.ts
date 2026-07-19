import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { TriggerSimulationDto } from './dto/trigger-simulation.dto';
import { SimulationScenarioService } from './simulation-scenario.service';

/**
 * ADMIN-only: instantiates disposable, tenant-scoped test incidents for
 * user-validation sessions (see ADR-0013). Never available to ordinary
 * tenant members — creating synthetic crisis data is an administrative
 * action, not a routine one.
 */
@ApiTags('simulation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('simulation')
export class SimulationController {
  constructor(private readonly simulationScenarios: SimulationScenarioService) {}

  @Post('trigger')
  @Roles(Role.ADMIN)
  trigger(@CurrentUser() user: AuthenticatedUser, @Body() dto: TriggerSimulationDto) {
    return this.simulationScenarios.trigger(user.tenantId, user.userId, dto.scenario);
  }
}
