import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsString, MinLength, ValidateNested } from 'class-validator';
import { BusinessImpactDto } from './business-impact.dto';
import { OptionDto } from './option.dto';
import { RiskDto } from './risk.dto';

/**
 * The qualitative/judgment half of the AI Output Contract (see ADR-0010) —
 * supplied by the caller (a human analyst today; a real LLM integration
 * later). `confidenceDimensions`, `evidenceUsed`, and the evidence-gap
 * portion of `missingInformation` are NOT part of this DTO — they are
 * always computed server-side and cannot be supplied here.
 */
export class SubmitIntelligenceAnalysisDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  situationSummary!: string;

  @ApiProperty({ type: BusinessImpactDto })
  @ValidateNested()
  @Type(() => BusinessImpactDto)
  businessImpact!: BusinessImpactDto;

  @ApiProperty({ type: [RiskDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RiskDto)
  criticalRisks!: RiskDto[];

  @ApiProperty({
    type: [String],
    description: 'Required even if empty — Principle 3: never hidden by omission.',
  })
  @IsArray()
  @IsString({ each: true })
  conflictingInformation!: string[];

  @ApiProperty({ type: OptionDto })
  @ValidateNested()
  @Type(() => OptionDto)
  recommendedDecision!: OptionDto;

  @ApiProperty({ type: [OptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  alternativeDecisions!: OptionDto[];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  expectedConsequences!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  immediateNextActions!: string[];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  executiveSummary!: string;
}
