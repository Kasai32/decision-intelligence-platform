import { ApiProperty } from '@nestjs/swagger';
import { IncidentSeverity } from '@prisma/client';
import { IsArray, IsEnum, IsString, MinLength } from 'class-validator';

export class BusinessImpactDto {
  @ApiProperty({ enum: IncidentSeverity })
  @IsEnum(IncidentSeverity)
  level!: IncidentSeverity;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  affectedSystems!: string[];
}
