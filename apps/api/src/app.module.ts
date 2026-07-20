import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ActionsModule } from './actions/actions.module';
import { AuthModule } from './auth/auth.module';
import { DecisionIntelligenceModule } from './decision-intelligence/decision-intelligence.module';
import { DecisionReportsModule } from './decision-reports/decision-reports.module';
import { DecisionsModule } from './decisions/decisions.module';
import { LoggerModule } from './common/logging/logger.module';
import { TenantRlsInterceptor } from './common/interceptors/tenant-rls.interceptor';
import { EvidenceModule } from './evidence/evidence.module';
import { ExecutiveBriefsModule } from './executive-briefs/executive-briefs.module';
import { HealthModule } from './health/health.module';
import { IncidentsModule } from './incidents/incidents.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { LessonsLearnedModule } from './lessons-learned/lessons-learned.module';
import { PrismaModule } from './prisma/prisma.module';
import { SimulationModule } from './simulation/simulation.module';
import { TenantsModule } from './tenants/tenants.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    // Global baseline rate limit (100 req/min per IP); auth.controller.ts
    // tightens this further on /auth/login and /auth/register.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
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
    SimulationModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Sets the Postgres RLS session variable per request (see ADR-0015).
    { provide: APP_INTERCEPTOR, useClass: TenantRlsInterceptor },
  ],
})
export class AppModule {}
