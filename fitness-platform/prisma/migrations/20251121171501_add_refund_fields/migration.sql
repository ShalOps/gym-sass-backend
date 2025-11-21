-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "refunded_amount" DECIMAL(12,2) DEFAULT 0,
ADD COLUMN     "refunded_at" TIMESTAMP(3);
