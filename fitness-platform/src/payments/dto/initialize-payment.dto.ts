import { ApiProperty } from '@nestjs/swagger';

export class InitializePaymentResponseDto {
  @ApiProperty({
    description: 'Our internal transaction reference',
    example: 'TX-123456789',
  })
  txRef: string;

  @ApiProperty({
    description: 'The URL to redirect the user to for payment',
    example: 'https://checkout.chapa.co/checkout/...',
  })
  checkoutUrl: string;
}
