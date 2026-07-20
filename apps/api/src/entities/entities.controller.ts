import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { CreateEntityDto } from './dto/create-entity.dto';
import { SearchEntitiesDto } from './dto/search-entities.dto';
import { ViewReasonDto } from './dto/view-reason.dto';
import { EntitiesService } from './entities.service';

@ApiTags('entities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('entities')
export class EntitiesController {
  constructor(private readonly entities: EntitiesService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEntityDto) {
    return this.entities.create(user.tenantId, user.userId, dto);
  }

  @Get()
  search(@CurrentUser() user: AuthenticatedUser, @Query() dto: SearchEntitiesDto) {
    return this.entities.search(user.tenantId, user.userId, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: ViewReasonDto,
  ) {
    return this.entities.findOne(user.tenantId, user.userId, id, query.reason);
  }

  @Get(':id/graph')
  getGraph(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: ViewReasonDto,
  ) {
    return this.entities.getGraph(user.tenantId, user.userId, id, query.reason);
  }
}
