-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TimelineEventType" ADD VALUE 'EXECUTIVE_BRIEF_GENERATED';
ALTER TYPE "TimelineEventType" ADD VALUE 'DECISION_REPORT_GENERATED';
ALTER TYPE "TimelineEventType" ADD VALUE 'LESSON_LEARNED_CREATED';

-- CreateTable
CREATE TABLE "executive_briefs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "incidentStatus" "IncidentStatus" NOT NULL,
    "incidentSeverity" "IncidentSeverity" NOT NULL,
    "summary" TEXT NOT NULL,
    "businessImpact" JSONB,
    "keyDecisions" JSONB NOT NULL,
    "openRisks" JSONB NOT NULL,
    "nextActions" JSONB NOT NULL,
    "additionalNotes" TEXT,
    "generatedByUserId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executive_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "status" "DecisionStatus" NOT NULL,
    "humanDecision" TEXT,
    "rationale" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "evidenceSummary" JSONB NOT NULL,
    "timelineSummary" JSONB NOT NULL,
    "additionalNotes" TEXT,
    "generatedByUserId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons_learned" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "whatHappened" TEXT NOT NULL,
    "whatWentWell" TEXT[],
    "whatToImprove" TEXT[],
    "actionItems" TEXT[],
    "tags" TEXT[],
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_learned_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "executive_briefs_tenantId_idx" ON "executive_briefs"("tenantId");

-- CreateIndex
CREATE INDEX "executive_briefs_incidentId_idx" ON "executive_briefs"("incidentId");

-- CreateIndex
CREATE INDEX "decision_reports_tenantId_idx" ON "decision_reports"("tenantId");

-- CreateIndex
CREATE INDEX "decision_reports_decisionId_idx" ON "decision_reports"("decisionId");

-- CreateIndex
CREATE INDEX "lessons_learned_tenantId_idx" ON "lessons_learned"("tenantId");

-- CreateIndex
CREATE INDEX "lessons_learned_incidentId_idx" ON "lessons_learned"("incidentId");

-- AddForeignKey
ALTER TABLE "executive_briefs" ADD CONSTRAINT "executive_briefs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executive_briefs" ADD CONSTRAINT "executive_briefs_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executive_briefs" ADD CONSTRAINT "executive_briefs_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_reports" ADD CONSTRAINT "decision_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_reports" ADD CONSTRAINT "decision_reports_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_reports" ADD CONSTRAINT "decision_reports_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons_learned" ADD CONSTRAINT "lessons_learned_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons_learned" ADD CONSTRAINT "lessons_learned_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons_learned" ADD CONSTRAINT "lessons_learned_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
