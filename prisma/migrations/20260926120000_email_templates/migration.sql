CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "process" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'uk',
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "EmailTemplate_process_locale_key" ON "EmailTemplate"("process", "locale");
CREATE INDEX "EmailTemplate_process_idx" ON "EmailTemplate"("process");