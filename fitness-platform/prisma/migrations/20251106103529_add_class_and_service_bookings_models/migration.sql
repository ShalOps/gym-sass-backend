-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "ClassBooking" (
    "classBookingId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "classId" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "notes" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassBooking_pkey" PRIMARY KEY ("classBookingId")
);

-- CreateTable
CREATE TABLE "ServiceBooking" (
    "serviceBookingId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "notes" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceBooking_pkey" PRIMARY KEY ("serviceBookingId")
);

-- CreateIndex
CREATE INDEX "ClassBooking_userId_idx" ON "ClassBooking"("userId");

-- CreateIndex
CREATE INDEX "ClassBooking_classId_idx" ON "ClassBooking"("classId");

-- CreateIndex
CREATE INDEX "ClassBooking_status_idx" ON "ClassBooking"("status");

-- CreateIndex
CREATE INDEX "ClassBooking_bookedAt_idx" ON "ClassBooking"("bookedAt");

-- CreateIndex
CREATE INDEX "ServiceBooking_userId_idx" ON "ServiceBooking"("userId");

-- CreateIndex
CREATE INDEX "ServiceBooking_serviceId_idx" ON "ServiceBooking"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceBooking_status_idx" ON "ServiceBooking"("status");

-- CreateIndex
CREATE INDEX "ServiceBooking_bookedAt_idx" ON "ServiceBooking"("bookedAt");

-- AddForeignKey
ALTER TABLE "ClassBooking" ADD CONSTRAINT "ClassBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassBooking" ADD CONSTRAINT "ClassBooking_classId_fkey" FOREIGN KEY ("classId") REFERENCES "GymClasses"("classId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("serviceId") ON DELETE CASCADE ON UPDATE CASCADE;
