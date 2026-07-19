import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GenerateExecutiveBriefDto {
  @ApiPropertyOptional({
    description: 'Optional human-supplied context — never fabricated by the engine.',
  })
  @IsOptional()
  @IsString()
  additionalNotes?: string;
}
