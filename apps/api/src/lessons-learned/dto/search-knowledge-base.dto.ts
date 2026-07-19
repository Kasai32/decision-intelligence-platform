import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SearchKnowledgeBaseDto {
  @ApiPropertyOptional({ description: 'Matched against title/whatHappened, case-insensitive.' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ description: 'Comma-separated tags, e.g. "database,timeout".' })
  @IsOptional()
  @IsString()
  tags?: string;
}
