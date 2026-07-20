import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { AuditLogService } from './audit-log.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

/**
 * Oversight surface for analyst activity (see ADR-0021) — ADMIN+ only, by
 * design: the point of an audit log is that the people being audited
 * aren't the ones who control who gets to review it.
 */
@ApiTags('audit-log')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  @Roles(Role.ADMIN)
  query(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryAuditLogDto) {
    return this.auditLog.query(user.tenantId, query);
  }
}
