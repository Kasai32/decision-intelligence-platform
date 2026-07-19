import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActionsModule } from './actions/actions.module';
import { AuthModule } from './auth/auth.module';
import { DecisionIntelligenceModule } from './decision-intelligence/decision-intelligence.module';
import { DecisionsModule } from './decisions/decisions.module';
import { EvidenceModule } from './evidence/evidence.module';
import { HealthModule } from './health/health.module';
import { IncidentsModule } from './incidents/incidents.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PrismaModule } from './prisma/prisma.module';
import { TenantsModule } from './tenants/tenants.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    IntegrationsModule,
    AuthModule,
    TenantsModule,
    IncidentsModule,
    DecisionsModule,
    EvidenceModule,
    ActionsModule,
    DecisionIntelligenceModule,
    HealthModule,
  ],
})
export class AppModule {}
