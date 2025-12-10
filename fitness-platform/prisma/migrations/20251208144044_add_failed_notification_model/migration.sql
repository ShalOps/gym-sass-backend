-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('TELEGRAM', 'EMAIL');

-- CreateTable
CREATE TABLE "FailedNotification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "channel" "Channel" NOT NULL,
    "payload" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailedNotification_pkey" PRIMARY KEY ("id")
);
