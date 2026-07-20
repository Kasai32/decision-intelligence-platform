import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityType } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * `evidenceId` is required, not optional — an entity with no evidence
 * citation should never exist (see ADR-0021, "never a bare assertion").
 */
export class CreateEntityDto {
  @ApiProperty({ enum: EntityType })
  @IsEnum(EntityType)
  type!: EntityType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Type-specific fields (DOB, registration number, coordinates...).',
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @ApiProperty({ description: 'The evidence this entity was identified from.' })
  @IsUUID()
  evidenceId!: string;

  @ApiPropertyOptional({ description: 'The specific snippet that named this entity, if known.' })
  @IsOptional()
  @IsString()
  extractedText?: string;

  /**
   * Both or neither (see ADR-0022) — `ValidateIf` fires for both fields
   * whenever either is present, so providing only one fails validation on
   * the missing one instead of silently persisting a half coordinate.
   */
  @ApiPropertyOptional({ description: 'WGS84 latitude. Required together with longitude.' })
  @ValidateIf((o: CreateEntityDto) => o.latitude !== undefined || o.longitude !== undefined)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'WGS84 longitude. Required together with latitude.' })
  @ValidateIf((o: CreateEntityDto) => o.latitude !== undefined || o.longitude !== undefined)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
