import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvidenceSourceCategory, EvidenceType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, IsUrl, MinLength } from 'class-validator';

export class CreateEvidenceDto {
  @ApiProperty()
  @IsUUID()
  incidentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  decisionId?: string;

  @ApiProperty({ enum: EvidenceType })
  @IsEnum(EvidenceType)
  type!: EvidenceType;

  @ApiPropertyOptional({
    enum: EvidenceSourceCategory,
    default: EvidenceSourceCategory.OTHER,
    description: 'Drives Phase 4 evidenceCompleteness/sourceReliability scoring — see ADR-0010.',
  })
  @IsOptional()
  @IsEnum(EvidenceSourceCategory)
  sourceCategory?: EvidenceSourceCategory;

  @ApiProperty({ description: 'Where this evidence came from, e.g. "Datadog", "manual"' })
  @IsString()
  @MinLength(1)
  source!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  summary!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  url?: string;
}
