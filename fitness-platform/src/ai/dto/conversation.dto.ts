import { IsString, IsArray, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConversationMessageDto {
  @ApiProperty({
    description: 'Role of the message sender',
    example: 'user',
    enum: ['user', 'assistant'],
  })
  @IsString()
  role: string;

  @ApiProperty({
    description: 'Message content',
    example: 'What workout should I do today?',
  })
  @IsString()
  text: string;

  @ApiProperty({
    description: 'Timestamp of the message',
    example: '2025-12-24T10:30:00.000Z',
  })
  @IsString()
  timestamp: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the message',
    example: { intent: 'workout_plans', confidence: 0.95 },
  })
  @IsOptional()
  metadata?: any;
}

export class ConversationDto {
  @ApiProperty({
    description: 'Unique conversation identifier',
    example: 'conv:123',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'User ID associated with the conversation',
    example: '123',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Array of messages in the conversation',
    type: [ConversationMessageDto],
  })
  @IsArray()
  messages: ConversationMessageDto[];
}

export class ConversationListDto {
  @ApiProperty({
    description: 'Array of user conversations',
    type: [ConversationDto],
  })
  @IsArray()
  conversations: ConversationDto[];

  @ApiProperty({
    description: 'Total number of conversations',
    example: 5,
  })
  total: number;
}
