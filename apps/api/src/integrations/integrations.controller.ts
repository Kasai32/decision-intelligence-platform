import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IntegrationKey, Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types';
import { ConfigureIntegrationDto } from './dto/configure-integration.dto';
import { UpdateIntegrationStatusDto } from './dto/update-integration-status.dto';
import { IntegrationConfigService } from './integration-config.service';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationConfig: IntegrationConfigService) {}

  @Get()
  listAll(@CurrentUser() user: AuthenticatedUser) {
    return this.integrationConfig.listAll(user.tenantId);
  }

  @Post(':providerType/config')
  @Roles(Role.ADMIN)
  configure(
    @CurrentUser() user: AuthenticatedUser,
    @Param('providerType', new ParseEnumPipe(IntegrationKey)) providerType: IntegrationKey,
    @Body() dto: ConfigureIntegrationDto,
  ) {
    return this.integrationConfig.configure(user.tenantId, providerType, dto.credentials);
  }

  @Patch(':providerType/config/status')
  @Roles(Role.ADMIN)
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('providerType', new ParseEnumPipe(IntegrationKey)) providerType: IntegrationKey,
    @Body() dto: UpdateIntegrationStatusDto,
  ) {
    return this.integrationConfig.updateStatus(user.tenantId, providerType, dto.status);
  }

  @Delete(':providerType/config')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('providerType', new ParseEnumPipe(IntegrationKey)) providerType: IntegrationKey,
  ) {
    await this.integrationConfig.remove(user.tenantId, providerType);
  }
}
