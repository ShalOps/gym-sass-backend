import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({
    description: 'The message content to send to the AI',
    example: 'What workout should I do today?',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'The user ID sending the message',
    example: '123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    description: 'Optional conversation ID for continuing a chat session',
    example: 'conv:123',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;
}
