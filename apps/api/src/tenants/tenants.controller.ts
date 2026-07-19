import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, Tenant } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { MemberSummary, TenantsService } from './tenants.service';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenants/me')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  getCurrentTenant(@CurrentUser() user: AuthenticatedUser): Promise<Tenant> {
    return this.tenantsService.getById(user.tenantId);
  }

  @Patch()
  @Roles(Role.ADMIN)
  updateCurrentTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTenantDto,
  ): Promise<Tenant> {
    return this.tenantsService.update(user.tenantId, dto);
  }

  @Get('members')
  listMembers(@CurrentUser() user: AuthenticatedUser): Promise<MemberSummary[]> {
    return this.tenantsService.listMembers(user.tenantId);
  }

  @Post('members')
  @Roles(Role.ADMIN)
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddMemberDto,
  ): Promise<MemberSummary> {
    return this.tenantsService.addMember(user.tenantId, dto);
  }

  @Delete('members/:userId')
  @Roles(Role.ADMIN)
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.tenantsService.removeMember(user.tenantId, userId);
  }
}
