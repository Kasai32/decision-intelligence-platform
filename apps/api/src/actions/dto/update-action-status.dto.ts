import { ApiProperty } from '@nestjs/swagger';
import { ActionStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateActionStatusDto {
  @ApiProperty({ enum: ActionStatus })
  @IsEnum(ActionStatus)
  status!: ActionStatus;
}
