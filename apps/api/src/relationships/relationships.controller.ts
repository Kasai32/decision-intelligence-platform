import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { RelationshipsService } from './relationships.service';

@ApiTags('relationships')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('relationships')
export class RelationshipsController {
  constructor(private readonly relationships: RelationshipsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRelationshipDto) {
    return this.relationships.create(user.tenantId, user.userId, dto);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.relationships.confirm(user.tenantId, user.userId, id);
  }

  @Post(':id/reject')
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.relationships.reject(user.tenantId, user.userId, id);
  }
}
