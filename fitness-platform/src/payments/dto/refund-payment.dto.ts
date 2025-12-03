import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefundPaymentDto {
  @ApiProperty({
    description: 'The transaction reference of the payment to refund',
  })
  @IsString()
  @IsNotEmpty()
  txRef: string;

  @ApiProperty({ description: 'Reason for the refund', required: false })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ description: 'Amount to refund', required: false })
  @IsOptional()
  amount?: number;
}
