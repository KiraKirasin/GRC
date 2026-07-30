-- AlterTable
ALTER TABLE "Policy" ADD COLUMN "links" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Policy" ADD COLUMN "attachments" TEXT NOT NULL DEFAULT '[]';
