import { Controller } from '@nestjs/common';
import { PaymentService } from './payments.service';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}
}
