import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export class RiskDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ enum: RISK_LEVELS })
  @IsIn(RISK_LEVELS)
  likelihood!: RiskLevel;

  @ApiProperty({ enum: RISK_LEVELS })
  @IsIn(RISK_LEVELS)
  impact!: RiskLevel;
}
