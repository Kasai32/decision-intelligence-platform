import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsString, IsUUID, ValidateNested } from 'class-validator';
import { ConfidenceDimensionsDto } from './confidence-dimensions.dto';
import { SubmitIntelligenceAnalysisDto } from './submit-intelligence-analysis.dto';

/**
 * The full AI Output Contract (see ADR-0010 / PREREQUIS.md §2). Extends the
 * caller-supplied qualitative fields with the fields the engine always
 * computes server-side. `DecisionIntelligenceEngineService.analyze()`
 * assembles an instance of this and validates it via class-validator's
 * `validate()` before persisting/returning — this is the "point d'accès
 * qui valide l'AI Output Contract" the spec asks for, applied to the full,
 * assembled object rather than just the raw request body.
 */
export class AIOutputContractDto extends SubmitIntelligenceAnalysisDto {
  @ApiProperty({
    type: [String],
    description: 'Evidence IDs actually linked to the incident — always computed, never supplied.',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  evidenceUsed!: string[];

  @ApiProperty({
    type: [String],
    description:
      'Required even if empty. Includes the evidence-completeness gap, always computed — Principle 3: never hidden.',
  })
  @IsArray()
  @IsString({ each: true })
  missingInformation!: string[];

  @ApiProperty({ type: ConfidenceDimensionsDto })
  @ValidateNested()
  @Type(() => ConfidenceDimensionsDto)
  confidenceDimensions!: ConfidenceDimensionsDto;
}
