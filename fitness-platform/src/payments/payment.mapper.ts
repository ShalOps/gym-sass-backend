import { Payment } from '@prisma/client';
import { VerifyPaymentResponseDto } from './dto/verify-payment.dto';

export class PaymentMapper {
  static toVerifyResponse(payment: Payment): VerifyPaymentResponseDto {
    let method = payment.method;
    if (!method && payment.chapaResponse) {
      const response = payment.chapaResponse as {
        payment_method?: string;
        method?: string;
        data?: { payment_method?: string; method?: string };
      };
      method =
        response?.payment_method ||
        response?.data?.payment_method ||
        response?.data?.method ||
        response?.method ||
        null;
    }

    return {
      id: payment.id,
      txRef: payment.txRef,
      chapaReference: payment.chapaReference ?? undefined,
      amount: payment.amount.toString(),
      status: payment.status,
      type: payment.type,
      method: method ?? undefined,
      verifiedAt: payment.verifiedAt?.toISOString(),
      chapaResponse: payment.chapaResponse,
    };
  }
}
