import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUrl, ValidateIf } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Type of payment (class booking, membership, etc.)',
    enum: PaymentType,
    example: PaymentType.BOOKING,
  })
  @IsEnum(PaymentType as object)
  type: PaymentType;

  @ApiPropertyOptional({
    description:
      'Required if type is BOOKING (Class). The ID of the class booking.',
    example: 1,
  })
  @ValidateIf((o: CreatePaymentDto) => o.type === PaymentType.BOOKING)
  @IsInt()
  classBookingId?: number;

  @ApiPropertyOptional({
    description:
      'Required if type is BOOKING (Service). The ID of the service booking.',
    example: 1,
  })
  @ValidateIf((o: CreatePaymentDto) => o.type === PaymentType.BOOKING)
  @IsInt()
  serviceBookingId?: number;

  @ApiProperty({
    description: 'Frontend URL to redirect after payment (success/fail)',
    example: 'https://gymsass.com/payment/success',
  })
  @IsUrl()
  returnUrl: string;

  @ApiPropertyOptional({
    description: 'Additional metadata (e.g., promo code, notes)',
    type: 'object',
    example: { promoCode: 'WELCOME50', note: 'First month discount' },
    additionalProperties: true,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
