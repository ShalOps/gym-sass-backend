/*
  Warnings:

  - The values [CLASS_BOOKING_APPROVED,SERVICE_BOOKING_APPROVED,BOOKING_PAYMENT_FAILED,NEW_GYM_REVIEW,NEW_CLASS_REVIEW,GYM_VERIFICATION_REQUEST,ADMIN_ALERT] on the enum `NotificationType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('NEW_CLASS_BOOKING', 'NEW_SERVICE_BOOKING', 'CLASS_BOOKING_CANCELLED', 'SERVICE_BOOKING_CANCELLED', 'CLASS_BOOKING_CONFIRMED', 'SERVICE_BOOKING_CONFIRMED');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
COMMIT;
