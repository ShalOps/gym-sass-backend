import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TelegramFallbackDto {
  @ApiProperty({ example: 1, description: 'ID of the conversation' })
  @IsInt()
  conversationId: number;

  @ApiProperty({
    example: 'Hello via Telegram',
    description: 'Message content',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
