-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isProfileComplete" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "password" DROP NOT NULL;
