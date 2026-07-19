import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsUrl, MinLength } from 'class-validator';

/** Generic inbound alert payload (Splunk/Jira/Sentinel-style — see ADR-0012). */
export class WebhookPayloadDto {
  @ApiProperty({ description: 'The incident this alert relates to.' })
  @IsUUID()
  incidentId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  summary!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  url?: string;
}
