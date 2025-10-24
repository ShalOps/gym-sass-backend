/*
  Warnings:

  - The primary key for the `Gym` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `gymId` on the `Gym` table. All the data in the column will be lost.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `userId` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Gym" DROP CONSTRAINT "Gym_gymOwnerId_fkey";

-- AlterTable
ALTER TABLE "Gym" DROP CONSTRAINT "Gym_pkey",
DROP COLUMN "gymId",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Gym_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "userId",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "Gym" ADD CONSTRAINT "Gym_gymOwnerId_fkey" FOREIGN KEY ("gymOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
