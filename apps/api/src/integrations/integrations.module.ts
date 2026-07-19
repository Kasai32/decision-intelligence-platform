import { Global, Module } from '@nestjs/common';
import { EvidenceModule } from '../evidence/evidence.module';
import { CredentialsEncryptionService } from './credentials-encryption.service';
import { IntegrationConfigService } from './integration-config.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsRegistryService } from './integrations-registry.service';
import { FixtureNetworkSimulator, NETWORK_SIMULATOR } from './network-simulator';
import { WebhookSignatureGuard } from './webhook-signature.guard';
import { WebhooksController } from './webhooks.controller';

@Global()
@Module({
  imports: [EvidenceModule],
  controllers: [IntegrationsController, WebhooksController],
  providers: [
    CredentialsEncryptionService,
    IntegrationsRegistryService,
    IntegrationConfigService,
    WebhookSignatureGuard,
    { provide: NETWORK_SIMULATOR, useClass: FixtureNetworkSimulator },
  ],
  exports: [CredentialsEncryptionService, IntegrationsRegistryService, IntegrationConfigService],
})
export class IntegrationsModule {}
