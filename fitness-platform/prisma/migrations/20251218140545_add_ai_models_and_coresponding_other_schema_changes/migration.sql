-- CreateEnum
CREATE TYPE "EnergyLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "FitnessLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "ClassBooking" ADD COLUMN     "attended" BOOLEAN DEFAULT false,
ADD COLUMN     "caloriesEst" INTEGER,
ADD COLUMN     "energyLevel" "EnergyLevel" DEFAULT 'MEDIUM',
ADD COLUMN     "medicalConstraints" TEXT,
ADD COLUMN     "microFeedback" TEXT,
ADD COLUMN     "preferredTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "searchQuery" TEXT,
ADD COLUMN     "sessionRating" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "classTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "consentFlags" JSONB,
ADD COLUMN     "equipmentAtHome" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "fitnessLevel" "FitnessLevel",
ADD COLUMN     "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "healthNotes" TEXT,
ADD COLUMN     "height" DOUBLE PRECISION,
ADD COLUMN     "injuries" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "instructors" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "preferences" JSONB,
ADD COLUMN     "preferredLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "preferredTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "priceRange" JSONB,
ADD COLUMN     "weight" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "SearchQuery" (
    "id" SERIAL NOT NULL,
    "query" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "results" JSONB,
    "intent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMetrics" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photos" JSONB,

    CONSTRAINT "UserMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIFeedback" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "feature" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewHistory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "state" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchQuery_userId_idx" ON "SearchQuery"("userId");

-- CreateIndex
CREATE INDEX "SearchQuery_createdAt_idx" ON "SearchQuery"("createdAt");

-- CreateIndex
CREATE INDEX "SearchQuery_intent_idx" ON "SearchQuery"("intent");

-- CreateIndex
CREATE INDEX "UserMetrics_userId_idx" ON "UserMetrics"("userId");

-- CreateIndex
CREATE INDEX "UserMetrics_date_idx" ON "UserMetrics"("date");

-- CreateIndex
CREATE INDEX "AIFeedback_userId_idx" ON "AIFeedback"("userId");

-- CreateIndex
CREATE INDEX "AIFeedback_feature_idx" ON "AIFeedback"("feature");

-- CreateIndex
CREATE INDEX "ViewHistory_userId_idx" ON "ViewHistory"("userId");

-- CreateIndex
CREATE INDEX "ViewHistory_entityType_idx" ON "ViewHistory"("entityType");

-- CreateIndex
CREATE INDEX "ViewHistory_timestamp_idx" ON "ViewHistory"("timestamp");

-- CreateIndex
CREATE INDEX "User_fitnessLevel_idx" ON "User"("fitnessLevel");

-- CreateIndex
CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");

-- AddForeignKey
ALTER TABLE "SearchQuery" ADD CONSTRAINT "SearchQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMetrics" ADD CONSTRAINT "UserMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFeedback" ADD CONSTRAINT "AIFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
