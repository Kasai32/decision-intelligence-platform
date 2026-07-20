import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EntityType } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

/** `reason` is required — same purpose-limitation rule as SearchEntitiesDto (see ADR-0021/ADR-0022). */
export class SearchNearbyDto {
  @ApiProperty({ description: 'WGS84 latitude of the search center.' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ description: 'WGS84 longitude of the search center.' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({ description: 'Search radius in kilometers.' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  radiusKm!: number;

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
