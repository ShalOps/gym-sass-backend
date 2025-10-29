/*
  Warnings:

  - The primary key for the `Gym` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Gym` table. All the data in the column will be lost.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - Made the column `email` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."Gym" DROP CONSTRAINT "Gym_gymOwnerId_fkey";

-- AlterTable
ALTER TABLE "Gym" DROP CONSTRAINT "Gym_pkey",
DROP COLUMN "id",
ADD COLUMN     "gymId" SERIAL NOT NULL,
ADD CONSTRAINT "Gym_pkey" PRIMARY KEY ("gymId");

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "id",
DROP COLUMN "updatedAt",
ADD COLUMN     "userId" SERIAL NOT NULL,
ALTER COLUMN "password" DROP NOT NULL,
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "phoneNo" DROP NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("userId");

-- AddForeignKey
ALTER TABLE "Gym" ADD CONSTRAINT "Gym_gymOwnerId_fkey" FOREIGN KEY ("gymOwnerId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
