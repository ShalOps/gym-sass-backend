import { DatabaseModule } from 'src/database/database.module';
import { Module } from '@nestjs/common';
import { GymClassReviewsController } from './gym-class-review.controller';
import { GymClassReviewsService } from './gym-class-review.service';

@Module({
  imports: [DatabaseModule],
  controllers: [GymClassReviewsController],
  providers: [GymClassReviewsService],
})
export class GymClassReviewModule {}
