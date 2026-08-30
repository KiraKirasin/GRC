-- AlterTable
ALTER TABLE "ProjectSystem" ADD COLUMN "registrySystemId" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "ProjectSystem_registrySystemId_idx" ON "ProjectSystem"("registrySystemId");
