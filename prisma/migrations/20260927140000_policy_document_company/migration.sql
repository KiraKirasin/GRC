-- AlterTable
ALTER TABLE "Policy" ADD COLUMN "company" TEXT NOT NULL DEFAULT 'NovaPay LLC';

-- AlterTable
ALTER TABLE "GRCDocument" ADD COLUMN "company" TEXT NOT NULL DEFAULT 'NovaPay LLC';
