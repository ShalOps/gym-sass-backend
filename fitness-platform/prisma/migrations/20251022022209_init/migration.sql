-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('WEIGHTLOSS', 'YOGA', 'BODYBUILDING');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN', 'GYMOWNER', 'TRAINER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateTable
CREATE TABLE "User" (
    "userId" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "password" TEXT,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNo" TEXT,
    "profilePic" TEXT,
    "bio" TEXT,
    "location" TEXT NOT NULL,
    "goal" "Goal" NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',

    CONSTRAINT "User_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Gym" (
    "gymId" SERIAL NOT NULL,
    "gymName" TEXT NOT NULL,
    "contactNo" TEXT,
    "location" TEXT NOT NULL,
    "workingHours" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "gymOwnerId" INTEGER NOT NULL,

    CONSTRAINT "Gym_pkey" PRIMARY KEY ("gymId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_userName_key" ON "User"("userName");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNo_key" ON "User"("phoneNo");

-- CreateIndex
CREATE UNIQUE INDEX "Gym_gymName_key" ON "Gym"("gymName");

-- AddForeignKey
ALTER TABLE "Gym" ADD CONSTRAINT "Gym_gymOwnerId_fkey" FOREIGN KEY ("gymOwnerId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
