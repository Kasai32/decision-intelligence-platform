import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityType } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
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
}
