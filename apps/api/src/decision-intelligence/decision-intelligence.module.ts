import { Module } from '@nestjs/common';
import { LlmModule } from '../common/llm/llm.module';
import { AiDraftStatusController } from './ai-draft/ai-draft-status.controller';
import { AiDraftService } from './ai-draft/ai-draft.service';
import { DecisionIntelligenceEngineController } from './decision-intelligence-engine.controller';
import { DecisionIntelligenceEngineService } from './decision-intelligence-engine.service';

@Module({
  imports: [LlmModule],
  controllers: [DecisionIntelligenceEngineController, AiDraftStatusController],
  providers: [DecisionIntelligenceEngineService, AiDraftService],
  exports: [DecisionIntelligenceEngineService],
})
export class DecisionIntelligenceModule {}
