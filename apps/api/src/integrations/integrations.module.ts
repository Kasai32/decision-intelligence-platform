import { Global, Module } from '@nestjs/common';
import { IntegrationsRegistryService } from './integrations-registry.service';

@Global()
@Module({
  providers: [IntegrationsRegistryService],
  exports: [IntegrationsRegistryService],
})
export class IntegrationsModule {}
