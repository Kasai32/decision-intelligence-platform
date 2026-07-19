import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * Credentials shape is provider-specific (see ADR-0012) — validated
 * generically as an object. This Phase 6 MVP uses encrypted fixtures, not
 * real OAuth tokens.
 */
export class ConfigureIntegrationDto {
  @ApiProperty({ type: Object, description: 'Provider-specific credentials, encrypted at rest.' })
  @IsObject()
  credentials!: Record<string, unknown>;
}
