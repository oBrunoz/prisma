-- CreateEnum
CREATE TYPE "CoverKind" AS ENUM ('FAVORITE', 'TITLE', 'NONE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "coverKind" "CoverKind" NOT NULL DEFAULT 'FAVORITE',
ADD COLUMN     "coverMediaId" TEXT,
ADD COLUMN     "coverPath" TEXT;

-- CreateTable
CREATE TABLE "avatars" (
    "userId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avatars_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "medias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
