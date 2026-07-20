import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { EntitiesController } from './entities.controller';
import { EntitiesService } from './entities.service';

@Module({
  imports: [AuditLogModule],
  controllers: [EntitiesController],
  providers: [EntitiesService],
  exports: [EntitiesService],
})
export class EntitiesModule {}
