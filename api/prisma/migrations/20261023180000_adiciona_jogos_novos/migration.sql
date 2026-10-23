-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GameKind" ADD VALUE 'FICHA';
ALTER TYPE "GameKind" ADD VALUE 'PERSONAGENS';
ALTER TYPE "GameKind" ADD VALUE 'LETREIRO';
ALTER TYPE "GameKind" ADD VALUE 'LEGENDA';
ALTER TYPE "GameKind" ADD VALUE 'ASSINATURA';
ALTER TYPE "GameKind" ADD VALUE 'CARREIRA';
ALTER TYPE "GameKind" ADD VALUE 'DUELO';
ALTER TYPE "GameKind" ADD VALUE 'LINHA';

-- AlterTable
ALTER TABLE "game_challenges" ADD COLUMN     "data" JSONB,
ALTER COLUMN "mediaId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "game_plays" ADD COLUMN     "hints" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "words" TEXT[] DEFAULT ARRAY[]::TEXT[];

