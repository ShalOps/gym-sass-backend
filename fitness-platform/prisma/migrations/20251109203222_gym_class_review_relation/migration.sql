/*
  Warnings:

  - A unique constraint covering the columns `[classId,userId]` on the table `GymClassReview` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."GymClassReviewResponse" DROP CONSTRAINT "GymClassReviewResponse_reviewId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GymClassReviewResponse" DROP CONSTRAINT "GymClassReviewResponse_trainerId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "GymClassReview_classId_userId_key" ON "GymClassReview"("classId", "userId");

-- AddForeignKey
ALTER TABLE "GymClassReviewResponse" ADD CONSTRAINT "GymClassReviewResponse_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "GymClassReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymClassReviewResponse" ADD CONSTRAINT "GymClassReviewResponse_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
