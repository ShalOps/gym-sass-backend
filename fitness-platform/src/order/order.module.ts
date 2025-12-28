import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PaymentsModule } from 'src/payments/payments.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [PaymentsModule, DatabaseModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
