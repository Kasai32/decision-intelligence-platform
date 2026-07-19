import { Module } from '@nestjs/common';
import { DecisionIntelligenceModule } from '../decision-intelligence/decision-intelligence.module';
import { DecisionsModule } from '../decisions/decisions.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { SimulationController } from './simulation.controller';
import { SimulationScenarioService } from './simulation-scenario.service';

/**
 * IntegrationConfigService and IntegrationsRegistryService come from the
 * @Global() IntegrationsModule and don't need to be imported here (see
 * ADR-0012).
 */
@Module({
  imports: [IncidentsModule, DecisionsModule, EvidenceModule, DecisionIntelligenceModule],
  controllers: [SimulationController],
  providers: [SimulationScenarioService],
  exports: [SimulationScenarioService],
})
export class SimulationModule {}
