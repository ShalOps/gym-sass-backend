import { DatabaseModule } from "src/database/database.module";
import { ReviewsService } from "./reviews.service";
import { Module } from "@nestjs/common";
import { ReviewsController } from "./reviews.controller";

@Module({
    imports: [DatabaseModule],
    controllers: [ReviewsController],
    providers: [ReviewsService],
})

export class ReviewsModule {}