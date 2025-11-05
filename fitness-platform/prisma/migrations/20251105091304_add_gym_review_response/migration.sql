-- CreateTable
CREATE TABLE "GymReview" (
    "id" SERIAL NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gymId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GymReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymReviewResponse" (
    "responseId" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,

    CONSTRAINT "GymReviewResponse_pkey" PRIMARY KEY ("responseId")
);

-- CreateIndex
CREATE INDEX "GymReview_rating_idx" ON "GymReview"("rating");

-- CreateIndex
CREATE INDEX "GymReview_createdAt_idx" ON "GymReview"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GymReview_gymId_userId_key" ON "GymReview"("gymId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GymReviewResponse_reviewId_key" ON "GymReviewResponse"("reviewId");

-- AddForeignKey
ALTER TABLE "GymReview" ADD CONSTRAINT "GymReview_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("gymId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymReview" ADD CONSTRAINT "GymReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymReviewResponse" ADD CONSTRAINT "GymReviewResponse_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "GymReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymReviewResponse" ADD CONSTRAINT "GymReviewResponse_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
