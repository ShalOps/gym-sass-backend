/*
  Warnings:

  - A unique constraint covering the columns `[cartOwnerId]` on the table `Cart` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Cart_cartOwnerId_key" ON "Cart"("cartOwnerId");
