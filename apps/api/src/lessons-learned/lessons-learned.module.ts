import { Module } from '@nestjs/common';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { LessonsLearnedController } from './lessons-learned.controller';
import { LessonsLearnedService } from './lessons-learned.service';

@Module({
  controllers: [LessonsLearnedController, KnowledgeBaseController],
  providers: [LessonsLearnedService],
  exports: [LessonsLearnedService],
})
export class LessonsLearnedModule {}
