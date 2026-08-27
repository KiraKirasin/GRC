-- AlterTable
ALTER TABLE "InformationSystem" ADD COLUMN "systemCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "InformationSystem" ADD COLUMN "systemType" TEXT NOT NULL DEFAULT 'app';
ALTER TABLE "InformationSystem" ADD COLUMN "placement" TEXT NOT NULL DEFAULT '';

-- Backfill unique legacy codes before unique index
UPDATE "InformationSystem" SET "systemCode" = 'legacy-' || substr("id", 1, 12) WHERE "systemCode" = '';

-- CreateIndex
CREATE UNIQUE INDEX "InformationSystem_systemCode_key" ON "InformationSystem"("systemCode");
