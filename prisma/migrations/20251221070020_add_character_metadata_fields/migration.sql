-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "matchNames" TEXT[],
ADD COLUMN     "sourceScriptId" TEXT,
ADD COLUMN     "sourceScriptTitle" TEXT,
ADD COLUMN     "sourceType" TEXT NOT NULL DEFAULT 'custom';
