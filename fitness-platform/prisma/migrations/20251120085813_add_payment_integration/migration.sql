/*
  Warnings:

  - You are about to drop the column `createdAt` on the `GymClasses` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `GymClasses` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('MEMBERSHIP', 'BOOKING', 'PURCHASE', 'PAYMENT_PLAN', 'FREE_TRIAL', 'MANUAL', 'OTHER');

-- DropForeignKey
ALTER TABLE "public"."GymClassReviewResponse" DROP CONSTRAINT "GymClassReviewResponse_reviewId_fkey";

-- AlterTable
ALTER TABLE "GymClasses" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt";

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "tx_ref" TEXT NOT NULL,
    "chapa_reference" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "customer_email" TEXT,
    "customer_first_name" TEXT,
    "customer_last_name" TEXT,
    "checkout_url" TEXT,
    "callback_url" TEXT,
    "return_url" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "type" "PaymentType" NOT NULL,
    "method" TEXT,
    "metadata" JSONB,
    "chapa_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "userId" INTEGER,
    "serviceBookingId" INTEGER,
    "classBookingId" INTEGER,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_tx_ref_key" ON "payments"("tx_ref");

-- CreateIndex
CREATE INDEX "payments_tx_ref_idx" ON "payments"("tx_ref");

-- CreateIndex
CREATE INDEX "payments_chapa_reference_idx" ON "payments"("chapa_reference");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_type_idx" ON "payments"("type");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "payments_serviceBookingId_idx" ON "payments"("serviceBookingId");

-- CreateIndex
CREATE INDEX "payments_classBookingId_idx" ON "payments"("classBookingId");

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_serviceBookingId_fkey" FOREIGN KEY ("serviceBookingId") REFERENCES "ServiceBooking"("serviceBookingId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_classBookingId_fkey" FOREIGN KEY ("classBookingId") REFERENCES "ClassBooking"("classBookingId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymClassReviewResponse" ADD CONSTRAINT "GymClassReviewResponse_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "GymClassReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
