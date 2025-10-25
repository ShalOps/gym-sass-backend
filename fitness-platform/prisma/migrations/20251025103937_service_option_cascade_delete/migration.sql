-- DropForeignKey
ALTER TABLE "public"."ServiceOption" DROP CONSTRAINT "ServiceOption_serviceId_fkey";

-- AddForeignKey
ALTER TABLE "ServiceOption" ADD CONSTRAINT "ServiceOption_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("serviceId") ON DELETE CASCADE ON UPDATE CASCADE;
