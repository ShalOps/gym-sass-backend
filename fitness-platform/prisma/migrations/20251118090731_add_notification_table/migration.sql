-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_CLASS_BOOKING', 'NEW_SERVICE_BOOKING', 'CLASS_BOOKING_CANCELLED', 'SERVICE_BOOKING_CANCELLED', 'CLASS_BOOKING_APPROVED', 'SERVICE_BOOKING_APPROVED', 'BOOKING_PAYMENT_FAILED', 'NEW_GYM_REVIEW', 'NEW_CLASS_REVIEW', 'GYM_VERIFICATION_REQUEST', 'ADMIN_ALERT');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ');

-- CreateTable
CREATE TABLE "Notification" (
    "notificationId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("notificationId")
);

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
