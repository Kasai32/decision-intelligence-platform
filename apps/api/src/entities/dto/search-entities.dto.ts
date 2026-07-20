import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * `reason` is required, not optional (see ADR-0021) — purpose limitation
 * for a search over the intelligence graph is a real access-oversight
 * requirement, not decoration.
 */
export class SearchEntitiesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ enum: EntityType })
  @IsOptional()
  @IsEnum(EntityType)
  type?: EntityType;

  @ApiProperty({
    description: 'Why this search is being performed — required, logged for oversight.',
  })
  @IsString()
  @MinLength(1)
  reason!: string;
}
