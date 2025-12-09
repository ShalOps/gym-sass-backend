import { IsInt, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeliveryReceiptDto {
  @ApiProperty({ example: 1, description: 'ID of the conversation' })
  @IsInt()
  @IsNotEmpty()
  conversationId: number;

  @ApiProperty({ example: 101, description: 'ID of the delivered message' })
  @IsInt()
  @IsNotEmpty()
  messageId: number;
}
