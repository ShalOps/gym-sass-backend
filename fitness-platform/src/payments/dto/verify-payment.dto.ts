import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus, PaymentType } from '@prisma/client';

export class VerifyPaymentResponseDto {
  @ApiProperty({ example: 123 })
  id: number;

  @ApiProperty({ example: 'TX-123456789' })
  txRef: string;

  @ApiProperty({ example: 'ch_1A2B3C4D5E6F', required: false })
  chapaReference?: string;

  @ApiProperty({ example: '250.00' })
  amount: string;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PROCESSED })
  status: PaymentStatus;

  @ApiProperty({ enum: PaymentType, example: PaymentType.BOOKING })
  type: PaymentType;

  @ApiProperty({
    description: 'When payment was verified as successful',
    required: false,
  })
  verifiedAt?: string;

  @ApiProperty({ description: 'Raw response from Chapa', required: false })
  chapaResponse?: any;
}
