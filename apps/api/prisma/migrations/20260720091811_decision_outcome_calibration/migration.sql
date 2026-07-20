-- CreateEnum
CREATE TYPE "DecisionOutcomeQuality" AS ENUM ('GOOD', 'BAD', 'MIXED', 'UNKNOWN');

-- AlterEnum
ALTER TYPE "TimelineEventType" ADD VALUE 'DECISION_OUTCOME_RECORDED';

-- CreateTable
CREATE TABLE "decision_outcomes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "intelligenceAnalysisId" TEXT,
    "outcomeQuality" "DecisionOutcomeQuality" NOT NULL,
    "notes" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "decision_outcomes_decisionId_key" ON "decision_outcomes"("decisionId");

-- CreateIndex
CREATE INDEX "decision_outcomes_tenantId_idx" ON "decision_outcomes"("tenantId");

-- AddForeignKey
ALTER TABLE "decision_outcomes" ADD CONSTRAINT "decision_outcomes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_outcomes" ADD CONSTRAINT "decision_outcomes_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_outcomes" ADD CONSTRAINT "decision_outcomes_intelligenceAnalysisId_fkey" FOREIGN KEY ("intelligenceAnalysisId") REFERENCES "intelligence_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_outcomes" ADD CONSTRAINT "decision_outcomes_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
