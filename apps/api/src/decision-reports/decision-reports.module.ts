import { Module } from '@nestjs/common';
import { DecisionReportsController } from './decision-reports.controller';
import { DecisionReportsService } from './decision-reports.service';

@Module({
  controllers: [DecisionReportsController],
  providers: [DecisionReportsService],
  exports: [DecisionReportsService],
})
export class DecisionReportsModule {}
