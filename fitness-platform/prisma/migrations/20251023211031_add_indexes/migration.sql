-- CreateIndex
CREATE INDEX "Gym_location_idx" ON "Gym"("location");

-- CreateIndex
CREATE INDEX "Gym_verified_idx" ON "Gym"("verified");

-- CreateIndex
CREATE INDEX "User_location_idx" ON "User"("location");

-- CreateIndex
CREATE INDEX "User_gender_idx" ON "User"("gender");

-- CreateIndex
CREATE INDEX "User_goal_idx" ON "User"("goal");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_firstName_idx" ON "User"("firstName");

-- CreateIndex
CREATE INDEX "User_lastName_idx" ON "User"("lastName");

-- CreateIndex
CREATE INDEX "User_birthDate_idx" ON "User"("birthDate");
