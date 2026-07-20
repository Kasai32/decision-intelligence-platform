import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { CalibrationService } from './calibration.service';

@ApiTags('decision-intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('decision-intelligence')
export class CalibrationController {
  constructor(private readonly calibration: CalibrationService) {}

  @Get('calibration-report')
  getReport(@CurrentUser() user: AuthenticatedUser) {
    return this.calibration.getReport(user.tenantId);
  }
}
