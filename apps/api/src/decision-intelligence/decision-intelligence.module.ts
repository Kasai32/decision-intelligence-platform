import { Module } from '@nestjs/common';
import { DecisionIntelligenceEngineController } from './decision-intelligence-engine.controller';
import { DecisionIntelligenceEngineService } from './decision-intelligence-engine.service';

@Module({
  controllers: [DecisionIntelligenceEngineController],
  providers: [DecisionIntelligenceEngineService],
  exports: [DecisionIntelligenceEngineService],
})
export class DecisionIntelligenceModule {}
