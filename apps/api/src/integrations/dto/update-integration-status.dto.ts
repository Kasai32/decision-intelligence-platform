import { ApiProperty } from '@nestjs/swagger';
import { IntegrationConfigStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateIntegrationStatusDto {
  @ApiProperty({ enum: IntegrationConfigStatus })
  @IsEnum(IntegrationConfigStatus)
  status!: IntegrationConfigStatus;
}
