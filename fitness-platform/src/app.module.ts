import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { GymsModule } from './gyms/gyms.module';
import { AuthModule } from './auth/auth.module';
import { ServicesModule } from './services/services.module';
import { ServiceOptionModule } from './service-option/service-option.module';
import { GymClassesModule } from './gym-classes/gym-classes.module';
import { ServiceOptionAssignmentModule } from './service-option-assignment/service-option-assignment.module';
import { ReviewsModule } from './gym-reviews/gym-reviews.module';
import { GymClassReviewModule } from './gym-class-review/gym-class-review.module';
import { AdminAnalyticsModule } from './admin-analytics/admin-analytics.module';

import { ConfigModule } from '@nestjs/config';
@Module({
  imports: [DatabaseModule, AuthModule, UsersModule, 
    GymsModule, ConfigModule.forRoot(), ServicesModule, 
    ServiceOptionModule, GymClassesModule, ServiceOptionAssignmentModule, 
    AdminAnalyticsModule,ReviewsModule, GymClassReviewModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}


