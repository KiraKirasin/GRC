-- CreateTable
CREATE TABLE "ProjectAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "registrySystemId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "supportOwner" TEXT NOT NULL DEFAULT '',
    "criticality" TEXT NOT NULL DEFAULT 'medium',
    "vendor" TEXT NOT NULL DEFAULT '',
    "consumers" TEXT NOT NULL DEFAULT '',
    "info" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProjectAsset_projectId_idx" ON "ProjectAsset"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAsset_registrySystemId_idx" ON "ProjectAsset"("registrySystemId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "ProjectAsset_projectId_name_key" ON "ProjectAsset"("projectId", "name");

-- AlterTable
ALTER TABLE "ProjectControl" ADD COLUMN "assetIds" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ProjectControl" ADD COLUMN "assetEvidence" TEXT NOT NULL DEFAULT '{}';
