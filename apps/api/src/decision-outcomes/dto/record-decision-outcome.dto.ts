import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DecisionOutcomeQuality } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * Entirely human-authored, like LessonLearned (see ADR-0011) — the system
 * never grades its own recommendation. See ADR-0016.
 */
export class RecordDecisionOutcomeDto {
  @ApiProperty({ enum: DecisionOutcomeQuality })
  @IsEnum(DecisionOutcomeQuality)
  outcomeQuality!: DecisionOutcomeQuality;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
