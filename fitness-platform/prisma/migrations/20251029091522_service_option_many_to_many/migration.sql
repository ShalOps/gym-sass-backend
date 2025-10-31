/*
  Warnings:

  - Made the column `password` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Category" AS ENUM ('STRENGTH', 'CARDIO', 'CROSSFIT', 'YOGA');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "password" SET NOT NULL;

-- CreateTable
CREATE TABLE "Service" (
    "serviceId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "duration" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "target" TEXT NOT NULL,
    "gymId" INTEGER NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("serviceId")
);

-- CreateTable
CREATE TABLE "ServiceOption" (
    "optionId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "gymId" INTEGER NOT NULL,

    CONSTRAINT "ServiceOption_pkey" PRIMARY KEY ("optionId")
);

-- CreateTable
CREATE TABLE "ServiceOptionAssignment" (
    "serviceId" INTEGER NOT NULL,
    "optionId" INTEGER NOT NULL,

    CONSTRAINT "ServiceOptionAssignment_pkey" PRIMARY KEY ("serviceId","optionId")
);

-- CreateTable
CREATE TABLE "GymClasses" (
    "classId" SERIAL NOT NULL,
    "className" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "classSchedule" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "duration" TEXT NOT NULL,
    "gymId" INTEGER NOT NULL,
    "trainerId" INTEGER NOT NULL,

    CONSTRAINT "GymClasses_pkey" PRIMARY KEY ("classId")
);

-- CreateIndex
CREATE INDEX "Gym_location_idx" ON "Gym"("location");

-- CreateIndex
CREATE INDEX "Gym_verified_idx" ON "Gym"("verified");

-- CreateIndex
CREATE INDEX "User_location_idx" ON "User"("location");

-- CreateIndex
CREATE INDEX "User_gender_idx" ON "User"("gender");

-- CreateIndex
CREATE INDEX "User_goal_idx" ON "User"("goal");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("gymId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOption" ADD CONSTRAINT "ServiceOption_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("gymId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOptionAssignment" ADD CONSTRAINT "ServiceOptionAssignment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("serviceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOptionAssignment" ADD CONSTRAINT "ServiceOptionAssignment_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ServiceOption"("optionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymClasses" ADD CONSTRAINT "GymClasses_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("gymId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymClasses" ADD CONSTRAINT "GymClasses_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
