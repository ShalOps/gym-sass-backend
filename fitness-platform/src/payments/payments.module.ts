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
import { getChapaModuleConfig } from '../config/payments.config';
import { PaymentMarketPlaceService } from './payments-marketplace.service';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    NotificationsModule,
    forwardRef(() => BookingsModule),
    ChapaModule.registerAsync({
      useFactory: getChapaModuleConfig,
    }),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentExportService, PaymentHistoryService, PaymentMarketPlaceService],
  exports: [PaymentService, PaymentExportService, PaymentHistoryService, PaymentMarketPlaceService],
})
export class PaymentsModule {}
