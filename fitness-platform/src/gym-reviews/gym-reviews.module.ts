import { DatabaseModule } from 'src/database/database.module';
import { ReviewsService } from './gym-reviews.service';
import { Module } from '@nestjs/common';
import { ReviewsController } from './gym-reviews.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
