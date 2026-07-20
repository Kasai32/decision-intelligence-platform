-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'VIEW_MAP';

-- AlterTable
ALTER TABLE "entities" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;
