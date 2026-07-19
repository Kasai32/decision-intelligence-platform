import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/**
 * Principle 1 (see ADR-0007): a Decision can only move to DECIDED with a
 * non-empty human-authored `humanDecision` AND a `decidedByUserId` that
 * DecisionsService verifies resolves to a real member of the tenant. Both
 * are required here at the DTO/shape level; the *existence* check on
 * `decidedByUserId` happens in the service (a DB lookup, not a DTO concern).
 */
export class DecideDecisionDto {
  @ApiProperty({ description: 'The human-authored decision text' })
  @IsString()
  @MinLength(1)
  humanDecision!: string;

  @ApiProperty({ description: 'The named human stakeholder who made this decision' })
  @IsUUID()
  decidedByUserId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rationale?: string;
}
