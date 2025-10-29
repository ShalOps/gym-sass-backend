/*
  Warnings:

  - The primary key for the `ServiceOptionAssignment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[serviceId,optionId,gymId]` on the table `ServiceOptionAssignment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `gymId` to the `ServiceOptionAssignment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ServiceOptionAssignment" DROP CONSTRAINT "ServiceOptionAssignment_pkey",
ADD COLUMN     "gymId" INTEGER NOT NULL,
ADD COLUMN     "optionAssignmentId" SERIAL NOT NULL,
ADD CONSTRAINT "ServiceOptionAssignment_pkey" PRIMARY KEY ("optionAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOptionAssignment_serviceId_optionId_gymId_key" ON "ServiceOptionAssignment"("serviceId", "optionId", "gymId");

-- AddForeignKey
ALTER TABLE "ServiceOptionAssignment" ADD CONSTRAINT "ServiceOptionAssignment_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("gymId") ON DELETE RESTRICT ON UPDATE CASCADE;
