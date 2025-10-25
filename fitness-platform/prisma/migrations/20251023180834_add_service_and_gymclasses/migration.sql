-- CreateTable
CREATE TABLE "Service" (
    "serviceId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "duration" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "gymId" INTEGER NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("serviceId")
);

-- CreateTable
CREATE TABLE "ServiceOption" (
    "optionId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT false,
    "serviceId" INTEGER NOT NULL,

    CONSTRAINT "ServiceOption_pkey" PRIMARY KEY ("optionId")
);

-- CreateTable
CREATE TABLE "GymClasses" (
    "classId" SERIAL NOT NULL,
    "className" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "classSchedule" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "duration" TEXT NOT NULL,
    "gymId" INTEGER NOT NULL,
    "trainerId" INTEGER NOT NULL,

    CONSTRAINT "GymClasses_pkey" PRIMARY KEY ("classId")
);

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("gymId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOption" ADD CONSTRAINT "ServiceOption_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("serviceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymClasses" ADD CONSTRAINT "GymClasses_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("gymId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymClasses" ADD CONSTRAINT "GymClasses_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
