import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class SelectTenantDto {
  @ApiProperty({ description: 'tenantSelectionToken returned by POST /auth/login' })
  @IsString()
  @MinLength(1)
  tenantSelectionToken!: string;

  @ApiProperty()
  @IsUUID()
  tenantId!: string;
}
