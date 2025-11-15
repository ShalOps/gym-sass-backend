-- CreateTable
CREATE TABLE "GymClassReview" (
    "id" SERIAL NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "classId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GymClassReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymClassReviewResponse" (
    "responseId" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewId" INTEGER NOT NULL,
    "trainerId" INTEGER,
    "ownerId" INTEGER,

    CONSTRAINT "GymClassReviewResponse_pkey" PRIMARY KEY ("responseId")
);

-- CreateIndex
CREATE UNIQUE INDEX "GymClassReviewResponse_reviewId_key" ON "GymClassReviewResponse"("reviewId");

-- AddForeignKey
ALTER TABLE "GymClassReview" ADD CONSTRAINT "GymClassReview_classId_fkey" FOREIGN KEY ("classId") REFERENCES "GymClasses"("classId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymClassReview" ADD CONSTRAINT "GymClassReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymClassReviewResponse" ADD CONSTRAINT "GymClassReviewResponse_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "GymClassReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymClassReviewResponse" ADD CONSTRAINT "GymClassReviewResponse_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymClassReviewResponse" ADD CONSTRAINT "GymClassReviewResponse_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
