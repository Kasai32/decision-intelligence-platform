import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EvidenceSourceCategory, EvidenceType, IntegrationKey } from '@prisma/client';
import { EvidenceService } from '../evidence/evidence.service';
import { DISPLAY_NAMES } from './configurable-integration.provider';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { WebhookSignatureGuard } from './webhook-signature.guard';

const PROVIDER_TO_SOURCE_CATEGORY: Record<IntegrationKey, EvidenceSourceCategory> = {
  [IntegrationKey.SERVICENOW]: EvidenceSourceCategory.TICKETING,
  [IntegrationKey.JIRA]: EvidenceSourceCategory.TICKETING,
  [IntegrationKey.SLACK]: EvidenceSourceCategory.CHAT,
  [IntegrationKey.TEAMS]: EvidenceSourceCategory.CHAT,
  [IntegrationKey.AWS]: EvidenceSourceCategory.CLOUD_PROVIDER,
  [IntegrationKey.AZURE]: EvidenceSourceCategory.CLOUD_PROVIDER,
  [IntegrationKey.GCP]: EvidenceSourceCategory.CLOUD_PROVIDER,
  [IntegrationKey.SPLUNK]: EvidenceSourceCategory.LOG_AGGREGATOR,
  [IntegrationKey.DATADOG]: EvidenceSourceCategory.MONITORING,
  [IntegrationKey.MICROSOFT_SENTINEL]: EvidenceSourceCategory.MONITORING,
};

/**
 * Generic inbound webhook receiver (see ADR-0012). Deliberately NOT behind
 * JwtAuthGuard — the caller is an external system with no user session;
 * the security boundary is WebhookSignatureGuard's HMAC check instead. A
 * valid webhook is recorded as system-originated Evidence (ADR-0006 already
 * allows a null `submittedByUserId` for exactly this case).
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post(':tenantId/:providerType')
  @UseGuards(WebhookSignatureGuard)
  receive(
    @Param('tenantId') tenantId: string,
    @Param('providerType') providerType: IntegrationKey,
    @Body() dto: WebhookPayloadDto,
  ) {
    return this.evidenceService.create(tenantId, null, {
      incidentId: dto.incidentId,
      type: EvidenceType.EXTERNAL_LINK,
      sourceCategory: PROVIDER_TO_SOURCE_CATEGORY[providerType],
      source: DISPLAY_NAMES[providerType],
      summary: dto.summary,
      url: dto.url,
    });
  }
}
