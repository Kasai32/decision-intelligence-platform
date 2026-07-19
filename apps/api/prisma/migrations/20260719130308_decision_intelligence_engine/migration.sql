-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('CLOUD_OUTAGE', 'SECURITY_BREACH', 'DATA_LOSS', 'PERFORMANCE_DEGRADATION', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceSourceCategory" AS ENUM ('MONITORING', 'CLOUD_PROVIDER', 'LOG_AGGREGATOR', 'TICKETING', 'CHAT', 'HUMAN', 'OTHER');

-- AlterEnum
ALTER TYPE "TimelineEventType" ADD VALUE 'INTELLIGENCE_ANALYSIS_GENERATED';

-- AlterTable
ALTER TABLE "evidence" ADD COLUMN     "sourceCategory" "EvidenceSourceCategory" NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "type" "IncidentType" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "intelligence_analyses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "evidenceCompleteness" INTEGER NOT NULL,
    "sourceReliability" INTEGER NOT NULL,
    "dataFreshness" INTEGER NOT NULL,
    "aiCertainty" INTEGER NOT NULL,
    "evidenceUsed" TEXT[],
    "missingInformation" TEXT[],
    "situationSummary" TEXT NOT NULL,
    "businessImpact" JSONB NOT NULL,
    "criticalRisks" JSONB NOT NULL,
    "conflictingInformation" TEXT[],
    "recommendedDecision" JSONB NOT NULL,
    "alternativeDecisions" JSONB NOT NULL,
    "expectedConsequences" TEXT NOT NULL,
    "immediateNextActions" TEXT[],
    "executiveSummary" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intelligence_analyses_tenantId_idx" ON "intelligence_analyses"("tenantId");

-- CreateIndex
CREATE INDEX "intelligence_analyses_incidentId_idx" ON "intelligence_analyses"("incidentId");

-- AddForeignKey
ALTER TABLE "intelligence_analyses" ADD CONSTRAINT "intelligence_analyses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_analyses" ADD CONSTRAINT "intelligence_analyses_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_analyses" ADD CONSTRAINT "intelligence_analyses_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
