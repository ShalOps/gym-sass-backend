import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentType } from '@prisma/client';

export class RecordManualPaymentDto {
  @ApiProperty({ description: 'Amount paid in ETB' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'User ID who made the payment' })
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @ApiProperty({
    description: 'Payment type (e.g. MEMBERSHIP, BOOKING)',
    enum: PaymentType,
  })
  @IsEnum(PaymentType)
  type: PaymentType;

  @ApiProperty({ description: 'Related Class Booking ID', required: false })
  @IsNumber()
  @IsOptional()
  classBookingId?: number;

  @ApiProperty({ description: 'Related Service Booking ID', required: false })
  @IsNumber()
  @IsOptional()
  serviceBookingId?: number;

  @ApiProperty({
    description: 'Notes or reference for the manual payment',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
