import { IsBoolean, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TypingDto {
  @ApiProperty({ example: 1, description: 'ID of the conversation' })
  @IsInt()
  conversationId: number;

  @ApiProperty({ example: true, description: 'Whether the user is typing' })
  @IsBoolean()
  isTyping: boolean;
}
