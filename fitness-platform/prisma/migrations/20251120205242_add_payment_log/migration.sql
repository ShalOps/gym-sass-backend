-- CreateTable
CREATE TABLE "PaymentLog" (
    "id" TEXT NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentLog_payment_id_idx" ON "PaymentLog"("payment_id");

-- AddForeignKey
ALTER TABLE "PaymentLog" ADD CONSTRAINT "PaymentLog_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
