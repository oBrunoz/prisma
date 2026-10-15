-- AlterTable
ALTER TABLE "users" ADD COLUMN     "followersSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "favorites" (
    "userId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("userId","position")
);

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_mediaId_key" ON "favorites"("userId", "mediaId");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "medias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
