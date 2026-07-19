import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvidenceType } from '@prisma/client';
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
