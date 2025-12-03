import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional } from 'class-validator';

export class ChapaWebhookDto {
  @ApiProperty({ example: 'payment.success' })
  @IsString()
  event: string;

  @ApiProperty({ example: 'TX-123456789' })
  @IsString()
  tx_ref: string;

  @ApiProperty({ example: 'ch_1A2B3C4D5E6F' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ example: 'success' })
  @IsString()
  status: string;

  @ApiProperty({ example: 250.0 })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'ETB' })
  @IsString()
  currency: string;

  @ApiProperty({ example: 'user@example.com', required: false })
  @IsOptional()
  @IsString()
  customer_email?: string;

  @ApiProperty({ description: 'Full payload from Chapa' })
  @IsOptional()
  data?: any;
}
