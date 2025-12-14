import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MarkReadDto {
  @ApiProperty({ example: 1, description: 'ID of the conversation' })
  @IsInt()
  conversationId: number;

  @ApiProperty({
    example: 101,
    description: 'ID of the message to mark as read',
  })
  @IsInt()
  messageId: number;
}
