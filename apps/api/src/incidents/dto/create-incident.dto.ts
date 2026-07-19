import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentSeverity, IncidentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateIncidentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiPropertyOptional({ enum: IncidentSeverity, default: IncidentSeverity.MEDIUM })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @ApiPropertyOptional({
    enum: IncidentType,
    default: IncidentType.OTHER,
    description: 'Drives Phase 4 evidenceCompleteness scoring — see ADR-0010.',
  })
  @IsOptional()
  @IsEnum(IncidentType)
  type?: IncidentType;
}
