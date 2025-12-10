import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClassBookingsService } from './class-bookings.service';
import { ServiceBookingsService } from './service-bookings.service';
import { ClassBookingsController } from './class-bookings.controller';
import { ServiceBookingsController } from './service-bookings.controller';
import { TelegramModule } from 'src/telegram/telegram.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    NotificationsModule,
    TelegramModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [ClassBookingsController, ServiceBookingsController],
  providers: [ClassBookingsService, ServiceBookingsService],
  exports: [ClassBookingsService, ServiceBookingsService],
})
export class BookingsModule {}
