/*
  Warnings:

  - You are about to drop the column `certificationFiles` on the `Trainer` table. All the data in the column will be lost.
  - You are about to drop the column `specializations` on the `Trainer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Trainer" DROP COLUMN "certificationFiles",
DROP COLUMN "specializations";

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" SERIAL NOT NULL,
    "trainerId" INTEGER NOT NULL,
    "requestedChanges" JSONB NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "updatedBy" INTEGER,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "issuingOrganization" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "fileUrl" TEXT NOT NULL,
    "trainerId" INTEGER NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerSpecialization" (
    "id" SERIAL NOT NULL,
    "category" "Category" NOT NULL,
    "detail" TEXT NOT NULL,
    "trainerId" INTEGER NOT NULL,

    CONSTRAINT "TrainerSpecialization_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerSpecialization" ADD CONSTRAINT "TrainerSpecialization_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
