import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/** Shared by GET :id and GET :id/graph — both require a stated reason (see ADR-0021). */
export class ViewReasonDto {
  @ApiProperty({ description: 'Why this record is being viewed — required, logged for oversight.' })
  @IsString()
  @MinLength(1)
  reason!: string;
}
