-- AlterTable
ALTER TABLE "ProjectControl" ADD COLUMN "systemIds" TEXT NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "ProjectSystem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "owner" TEXT NOT NULL DEFAULT '',
    "serverLocation" TEXT NOT NULL DEFAULT '',
    "techSpecs" TEXT NOT NULL DEFAULT '',
    "os" TEXT NOT NULL DEFAULT '',
    "failover" TEXT NOT NULL DEFAULT '',
    "security" TEXT NOT NULL DEFAULT '',
    "criticality" TEXT NOT NULL DEFAULT 'medium',
    "equipment" TEXT NOT NULL DEFAULT '',
    "info" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectSystem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProjectSystem_projectId_idx" ON "ProjectSystem"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSystem_projectId_name_key" ON "ProjectSystem"("projectId", "name");
