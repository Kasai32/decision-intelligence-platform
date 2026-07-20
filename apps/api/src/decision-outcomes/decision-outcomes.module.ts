import { Module } from '@nestjs/common';
import { CalibrationController } from './calibration.controller';
import { CalibrationService } from './calibration.service';
import { DecisionOutcomesController } from './decision-outcomes.controller';
import { DecisionOutcomesService } from './decision-outcomes.service';

@Module({
  controllers: [DecisionOutcomesController, CalibrationController],
  providers: [DecisionOutcomesService, CalibrationService],
  exports: [DecisionOutcomesService, CalibrationService],
})
export class DecisionOutcomesModule {}
