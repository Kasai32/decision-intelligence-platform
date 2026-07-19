import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class OpenDecisionDto {
  @ApiProperty()
  @IsUUID()
  incidentId!: string;

  @ApiProperty({ description: 'The question this decision must answer' })
  @IsString()
  @MinLength(1)
  question!: string;
}
