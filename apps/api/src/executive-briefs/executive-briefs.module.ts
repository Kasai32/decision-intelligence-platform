import { Module } from '@nestjs/common';
import { ExecutiveBriefsController } from './executive-briefs.controller';
import { ExecutiveBriefsService } from './executive-briefs.service';

@Module({
  controllers: [ExecutiveBriefsController],
  providers: [ExecutiveBriefsService],
  exports: [ExecutiveBriefsService],
})
export class ExecutiveBriefsModule {}
