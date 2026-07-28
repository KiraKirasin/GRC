-- AlterTable
ALTER TABLE "GRCControl" ADD COLUMN "controlCode" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "AssessmentWorkbook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "businessUnit" TEXT NOT NULL DEFAULT 'NovaPay',
    "country" TEXT NOT NULL DEFAULT 'UA',
    "standard" TEXT NOT NULL DEFAULT '',
    "startDate" TEXT NOT NULL DEFAULT '',
    "endDate" TEXT NOT NULL DEFAULT '',
    "leadAuditor" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "domainFilter" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AssessmentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workbookId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_assessed',
    "score" INTEGER,
    "evidenceLink" TEXT NOT NULL DEFAULT '',
    "comments" TEXT NOT NULL DEFAULT '',
    "assessedAt" TEXT NOT NULL DEFAULT '',
    "assessedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssessmentItem_workbookId_fkey" FOREIGN KEY ("workbookId") REFERENCES "AssessmentWorkbook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentItem_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "GRCControl" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workbookId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL DEFAULT '',
    "controlId" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL DEFAULT '',
    "version" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssessmentEvidence_workbookId_fkey" FOREIGN KEY ("workbookId") REFERENCES "AssessmentWorkbook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workbookId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "controlId" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "rootCause" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssessmentFinding_workbookId_fkey" FOREIGN KEY ("workbookId") REFERENCES "AssessmentWorkbook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentRisk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workbookId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "likelihood" INTEGER NOT NULL DEFAULT 3,
    "impact" INTEGER NOT NULL DEFAULT 3,
    "residual" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "autoCreated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssessmentRisk_workbookId_fkey" FOREIGN KEY ("workbookId") REFERENCES "AssessmentWorkbook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionPlanItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workbookId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT '',
    "owner" TEXT NOT NULL DEFAULT '',
    "dueDate" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "findingId" TEXT NOT NULL DEFAULT '',
    "controlId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActionPlanItem_workbookId_fkey" FOREIGN KEY ("workbookId") REFERENCES "AssessmentWorkbook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentException" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workbookId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'risk_acceptance',
    "description" TEXT NOT NULL DEFAULT '',
    "compensating" TEXT NOT NULL DEFAULT '',
    "expiration" TEXT NOT NULL DEFAULT '',
    "approver" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssessmentException_workbookId_fkey" FOREIGN KEY ("workbookId") REFERENCES "AssessmentWorkbook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentItem_workbookId_controlId_key" ON "AssessmentItem"("workbookId", "controlId");
