import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Entirely human-authored (see ADR-0011) — genuine retrospective insight
 * cannot be computed from structured incident data.
 */
export class CreateLessonLearnedDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  whatHappened!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whatWentWell?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whatToImprove?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actionItems?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Free-form tags for Knowledge Base search.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
