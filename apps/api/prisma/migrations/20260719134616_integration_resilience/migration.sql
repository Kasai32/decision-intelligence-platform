-- CreateEnum
CREATE TYPE "IntegrationKey" AS ENUM ('SERVICENOW', 'JIRA', 'SLACK', 'TEAMS', 'AWS', 'AZURE', 'GCP', 'SPLUNK', 'DATADOG', 'MICROSOFT_SENTINEL');

-- CreateEnum
CREATE TYPE "IntegrationConfigStatus" AS ENUM ('ACTIVE', 'BROKEN');

-- AlterEnum
ALTER TYPE "TimelineEventType" ADD VALUE 'INTEGRATION_BLOCKED';

-- CreateTable
CREATE TABLE "integration_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "providerType" "IntegrationKey" NOT NULL,
    "encryptedCredentials" TEXT NOT NULL,
    "status" "IntegrationConfigStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_configs_tenantId_idx" ON "integration_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "integration_configs_tenantId_providerType_key" ON "integration_configs"("tenantId", "providerType");

-- AddForeignKey
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
