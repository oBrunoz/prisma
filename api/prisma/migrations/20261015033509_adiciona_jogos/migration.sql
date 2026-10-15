-- CreateEnum
CREATE TYPE "GameKind" AS ENUM ('FRAMES', 'POSTER');

-- CreateEnum
CREATE TYPE "GameResult" AS ENUM ('WON', 'LOST');

-- CreateTable
CREATE TABLE "game_challenges" (
    "id" TEXT NOT NULL,
    "kind" "GameKind" NOT NULL,
    "day" DATE NOT NULL,
    "number" INTEGER NOT NULL,
    "mediaId" TEXT NOT NULL,
    "images" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_plays" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "guesses" INTEGER[],
    "result" "GameResult",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_plays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_challenges_kind_day_key" ON "game_challenges"("kind", "day");

-- CreateIndex
CREATE UNIQUE INDEX "game_challenges_kind_number_key" ON "game_challenges"("kind", "number");

-- CreateIndex
CREATE UNIQUE INDEX "game_plays_userId_challengeId_key" ON "game_plays"("userId", "challengeId");

-- AddForeignKey
ALTER TABLE "game_challenges" ADD CONSTRAINT "game_challenges_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "medias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_plays" ADD CONSTRAINT "game_plays_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_plays" ADD CONSTRAINT "game_plays_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "game_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
