/*
  Warnings:

  - A unique constraint covering the columns `[name,gymId]` on the table `Service` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,gymId]` on the table `ServiceOption` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Service_name_key";

-- DropIndex
DROP INDEX "public"."ServiceOption_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_gymId_key" ON "Service"("name", "gymId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOption_name_gymId_key" ON "ServiceOption"("name", "gymId");
