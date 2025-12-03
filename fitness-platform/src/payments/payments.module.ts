import { Module, forwardRef } from '@nestjs/common';
import { PaymentService } from './payments.service';
import { PaymentExportService } from './payment-export.service';
import { PaymentHistoryService } from './payment-history.service';
import { PaymentController } from './payments.controller';
import { DatabaseModule } from '../database/database.module';
import { ChapaModule } from 'chapa-nestjs';
import { ConfigModule } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    NotificationsModule,
    forwardRef(() => BookingsModule),
    ChapaModule.registerAsync({
      useFactory: () => ({
        secretKey: process.env.CHAPA_TEST_SECRET_KEY!, // subject to change for production
        webhookSecret: process.env.CHAPA_WEBHOOK_SECRET,
      }),
    }),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentExportService, PaymentHistoryService],
  exports: [PaymentService, PaymentExportService, PaymentHistoryService],
})
export class PaymentsModule {}
