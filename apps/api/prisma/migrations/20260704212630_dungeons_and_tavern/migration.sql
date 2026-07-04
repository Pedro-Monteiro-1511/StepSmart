-- CreateEnum
CREATE TYPE "DungeonResult" AS ENUM ('WIN', 'LOSE');

-- CreateEnum
CREATE TYPE "TavernQuestStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CLAIMED');

-- CreateTable
CREATE TABLE "Dungeon" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "difficulty" INTEGER NOT NULL,
    "lootTable" JSONB NOT NULL,
    "xpRewardWin" INTEGER NOT NULL,
    "xpRewardLose" INTEGER NOT NULL,
    "coinsRewardWin" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Dungeon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DungeonRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dungeonId" TEXT NOT NULL,
    "result" "DungeonResult" NOT NULL,
    "combatLog" JSONB NOT NULL,
    "xpGained" INTEGER NOT NULL,
    "coinsGained" INTEGER NOT NULL,
    "lootItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DungeonRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDungeonState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptsAvailable" INTEGER NOT NULL DEFAULT 3,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastRegenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extraAttemptsBoughtToday" INTEGER NOT NULL DEFAULT 0,
    "date" DATE NOT NULL,

    CONSTRAINT "UserDungeonState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TavernQuest" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "costCoins" INTEGER NOT NULL DEFAULT 0,
    "rewardPayload" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TavernQuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTavernQuest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tavernQuestId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "TavernQuestStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "resultPayload" JSONB,

    CONSTRAINT "UserTavernQuest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dungeon_key_key" ON "Dungeon"("key");

-- CreateIndex
CREATE INDEX "DungeonRun_userId_createdAt_idx" ON "DungeonRun"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserDungeonState_userId_key" ON "UserDungeonState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TavernQuest_key_key" ON "TavernQuest"("key");

-- CreateIndex
CREATE INDEX "UserTavernQuest_userId_status_idx" ON "UserTavernQuest"("userId", "status");

-- AddForeignKey
ALTER TABLE "DungeonRun" ADD CONSTRAINT "DungeonRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonRun" ADD CONSTRAINT "DungeonRun_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "Dungeon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDungeonState" ADD CONSTRAINT "UserDungeonState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTavernQuest" ADD CONSTRAINT "UserTavernQuest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTavernQuest" ADD CONSTRAINT "UserTavernQuest_tavernQuestId_fkey" FOREIGN KEY ("tavernQuestId") REFERENCES "TavernQuest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
