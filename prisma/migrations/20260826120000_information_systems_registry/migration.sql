-- CreateTable
CREATE TABLE "InformationSystem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "supportOwner" TEXT NOT NULL DEFAULT '',
    "appServers" TEXT NOT NULL DEFAULT '',
    "osContainer" TEXT NOT NULL DEFAULT '',
    "dbServers" TEXT NOT NULL DEFAULT '',
    "techSpecs" TEXT NOT NULL DEFAULT '',
    "datacenter" TEXT NOT NULL DEFAULT '',
    "failover" TEXT NOT NULL DEFAULT '',
    "security" TEXT NOT NULL DEFAULT '',
    "criticality" TEXT NOT NULL DEFAULT 'medium',
    "equipment" TEXT NOT NULL DEFAULT '',
    "info" TEXT NOT NULL DEFAULT '',
    "vendor" TEXT NOT NULL DEFAULT '',
    "consumers" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "InformationSystem_company_idx" ON "InformationSystem"("company");

-- CreateIndex
CREATE UNIQUE INDEX "InformationSystem_company_name_key" ON "InformationSystem"("company", "name");
