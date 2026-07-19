import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActionsModule } from './actions/actions.module';
import { AuthModule } from './auth/auth.module';
import { DecisionIntelligenceModule } from './decision-intelligence/decision-intelligence.module';
import { DecisionReportsModule } from './decision-reports/decision-reports.module';
import { DecisionsModule } from './decisions/decisions.module';
import { EvidenceModule } from './evidence/evidence.module';
import { ExecutiveBriefsModule } from './executive-briefs/executive-briefs.module';
import { HealthModule } from './health/health.module';
import { IncidentsModule } from './incidents/incidents.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { LessonsLearnedModule } from './lessons-learned/lessons-learned.module';
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
    ExecutiveBriefsModule,
    DecisionReportsModule,
    LessonsLearnedModule,
    HealthModule,
  ],
})
export class AppModule {}
