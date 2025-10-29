-- DropForeignKey
ALTER TABLE "public"."GymClasses" DROP CONSTRAINT "GymClasses_gymId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Service" DROP CONSTRAINT "Service_gymId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceOption" DROP CONSTRAINT "ServiceOption_gymId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceOptionAssignment" DROP CONSTRAINT "ServiceOptionAssignment_gymId_fkey";

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("gymId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOption" ADD CONSTRAINT "ServiceOption_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("gymId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOptionAssignment" ADD CONSTRAINT "ServiceOptionAssignment_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("gymId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymClasses" ADD CONSTRAINT "GymClasses_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("gymId") ON DELETE CASCADE ON UPDATE CASCADE;
