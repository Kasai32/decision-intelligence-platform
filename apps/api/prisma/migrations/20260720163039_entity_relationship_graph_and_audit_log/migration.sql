-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PERSON', 'ORGANIZATION', 'LOCATION', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('ASSOCIATED_WITH', 'EMPLOYED_BY', 'MEMBER_OF', 'LOCATED_AT', 'PRESENT_AT', 'COMMUNICATED_WITH', 'TRANSACTED_WITH', 'OWNS', 'OTHER');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('SUGGESTED', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MergeSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('SEARCH', 'VIEW_ENTITY', 'VIEW_RELATIONSHIP', 'VIEW_GRAPH', 'CREATE_ENTITY', 'CREATE_RELATIONSHIP', 'CONFIRM_RELATIONSHIP', 'REJECT_RELATIONSHIP', 'MERGE_ENTITIES', 'EXPORT');

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "EntityType" NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationships" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromEntityId" TEXT NOT NULL,
    "toEntityId" TEXT NOT NULL,
    "type" "RelationshipType" NOT NULL,
    "label" TEXT,
    "status" "RelationshipStatus" NOT NULL DEFAULT 'SUGGESTED',
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_evidence_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "extractedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_evidence_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_merge_suggestions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityAId" TEXT NOT NULL,
    "entityBId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "MergeSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_merge_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entities_tenantId_type_idx" ON "entities"("tenantId", "type");

-- CreateIndex
CREATE INDEX "relationships_tenantId_fromEntityId_idx" ON "relationships"("tenantId", "fromEntityId");

-- CreateIndex
CREATE INDEX "relationships_tenantId_toEntityId_idx" ON "relationships"("tenantId", "toEntityId");

-- CreateIndex
CREATE INDEX "entity_evidence_links_tenantId_idx" ON "entity_evidence_links"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "entity_evidence_links_entityId_evidenceId_key" ON "entity_evidence_links"("entityId", "evidenceId");

-- CreateIndex
CREATE INDEX "relationship_evidence_links_tenantId_idx" ON "relationship_evidence_links"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "relationship_evidence_links_relationshipId_evidenceId_key" ON "relationship_evidence_links"("relationshipId", "evidenceId");

-- CreateIndex
CREATE INDEX "entity_merge_suggestions_tenantId_idx" ON "entity_merge_suggestions"("tenantId");

-- CreateIndex
CREATE INDEX "audit_log_entries_tenantId_actorUserId_occurredAt_idx" ON "audit_log_entries"("tenantId", "actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_log_entries_tenantId_targetType_targetId_idx" ON "audit_log_entries"("tenantId", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_evidence_links" ADD CONSTRAINT "entity_evidence_links_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_evidence_links" ADD CONSTRAINT "entity_evidence_links_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_evidence_links" ADD CONSTRAINT "relationship_evidence_links_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "relationships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_evidence_links" ADD CONSTRAINT "relationship_evidence_links_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_merge_suggestions" ADD CONSTRAINT "entity_merge_suggestions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_merge_suggestions" ADD CONSTRAINT "entity_merge_suggestions_entityAId_fkey" FOREIGN KEY ("entityAId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_merge_suggestions" ADD CONSTRAINT "entity_merge_suggestions_entityBId_fkey" FOREIGN KEY ("entityBId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_merge_suggestions" ADD CONSTRAINT "entity_merge_suggestions_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
