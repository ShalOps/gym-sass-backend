/*
  Warnings:

  - A unique constraint covering the columns `[coverPhotoId]` on the table `Gym` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[coverPhotoId]` on the table `GymClasses` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PhotoEntityType" AS ENUM ('GYM', 'CLASS');

-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "coverPhotoId" INTEGER;

-- AlterTable
ALTER TABLE "GymClasses" ADD COLUMN     "coverPhotoId" INTEGER;

-- CreateTable
CREATE TABLE "Photo" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "entityType" "PhotoEntityType" NOT NULL,
    "entityId" INTEGER NOT NULL,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Gym_coverPhotoId_key" ON "Gym"("coverPhotoId");

-- CreateIndex
CREATE UNIQUE INDEX "GymClasses_coverPhotoId_key" ON "GymClasses"("coverPhotoId");

-- AddForeignKey
ALTER TABLE "Gym" ADD CONSTRAINT "Gym_coverPhotoId_fkey" FOREIGN KEY ("coverPhotoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymClasses" ADD CONSTRAINT "GymClasses_coverPhotoId_fkey" FOREIGN KEY ("coverPhotoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
