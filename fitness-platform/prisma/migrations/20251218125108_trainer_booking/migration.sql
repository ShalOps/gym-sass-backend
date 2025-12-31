-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Trainer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "bio" TEXT,
    "gender" TEXT,
    "dob" TIMESTAMP(3),
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "specializations" JSONB NOT NULL,
    "yearsOfExperience" INTEGER NOT NULL,
    "profilePicture" TEXT,
    "certificationFiles" JSONB NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerAvailability" (
    "id" SERIAL NOT NULL,
    "trainerId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TrainerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerGym" (
    "id" SERIAL NOT NULL,
    "trainerId" INTEGER NOT NULL,
    "gymId" INTEGER NOT NULL,

    CONSTRAINT "TrainerGym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerBooking" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "trainerId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "sessionType" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "rescheduledFrom" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerReview" (
    "id" SERIAL NOT NULL,
    "trainerId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,

    CONSTRAINT "TrainerReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trainer_userId_key" ON "Trainer"("userId");

-- CreateIndex
CREATE INDEX "TrainerAvailability_trainerId_dayOfWeek_idx" ON "TrainerAvailability"("trainerId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerGym_trainerId_gymId_key" ON "TrainerGym"("trainerId", "gymId");

-- CreateIndex
CREATE INDEX "TrainerBooking_trainerId_date_idx" ON "TrainerBooking"("trainerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerReview_bookingId_key" ON "TrainerReview"("bookingId");

-- AddForeignKey
ALTER TABLE "Trainer" ADD CONSTRAINT "Trainer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerAvailability" ADD CONSTRAINT "TrainerAvailability_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerGym" ADD CONSTRAINT "TrainerGym_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerGym" ADD CONSTRAINT "TrainerGym_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("gymId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerBooking" ADD CONSTRAINT "TrainerBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerBooking" ADD CONSTRAINT "TrainerBooking_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerBooking" ADD CONSTRAINT "TrainerBooking_rescheduledFrom_fkey" FOREIGN KEY ("rescheduledFrom") REFERENCES "TrainerBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerReview" ADD CONSTRAINT "TrainerReview_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerReview" ADD CONSTRAINT "TrainerReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerReview" ADD CONSTRAINT "TrainerReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "TrainerBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
