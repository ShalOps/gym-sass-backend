import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ClassBookingsService } from './class-bookings.service';
import { ServiceBookingsService } from './service-bookings.service';
import { ClassBookingsController } from './class-bookings.controller';
import { ServiceBookingsController } from './service-bookings.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [ClassBookingsController, ServiceBookingsController],
  providers: [ClassBookingsService, ServiceBookingsService],
  exports: [ClassBookingsService, ServiceBookingsService],
})
export class BookingsModule {}
