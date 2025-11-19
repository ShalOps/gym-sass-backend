import { DatabaseModule } from "src/database/database.module";
import { Module } from "@nestjs/common";
import { GymAnalyticsService } from "./gym-analytics.service";
import { GymAnalyticsController } from "./gym-analytics.controller";

@Module({
    imports: [DatabaseModule],
    controllers: [GymAnalyticsController],
    providers: [GymAnalyticsService],
})

export class GymAnalyticsModule {}