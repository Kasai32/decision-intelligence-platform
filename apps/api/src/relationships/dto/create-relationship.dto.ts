import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationshipType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * `evidenceId` is required — a relationship with no evidence citation
 * should never exist (see ADR-0021). Created relationships always start
 * SUGGESTED regardless of who creates them or what evidence they cite —
 * confirming is a separate, explicit step (RelationshipsService.confirm).
 */
export class CreateRelationshipDto {
  @ApiProperty()
  @IsUUID()
  fromEntityId!: string;

  @ApiProperty()
  @IsUUID()
  toEntityId!: string;

  @ApiProperty({ enum: RelationshipType })
  @IsEnum(RelationshipType)
  type!: RelationshipType;

  @ApiPropertyOptional({
    description: 'Free-text specifics when `type` alone is not enough detail.',
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ description: 'The evidence that supports this relationship.' })
  @IsUUID()
  evidenceId!: string;
}
