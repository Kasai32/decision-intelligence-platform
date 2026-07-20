import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RelationshipsController } from './relationships.controller';
import { RelationshipsService } from './relationships.service';

@Module({
  imports: [AuditLogModule],
  controllers: [RelationshipsController],
  providers: [RelationshipsService],
  exports: [RelationshipsService],
})
export class RelationshipsModule {}
