import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: 1, description: 'ID of the conversation' })
  @IsInt()
  conversationId: number;

  @ApiPropertyOptional({
    example: 'Hello world',
    description: 'Content of the message',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    example: [1, 2],
    description: 'List of attachment IDs',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  attachmentIds?: number[];

  @ApiPropertyOptional({
    example: 99,
    description: 'ID of the message being replied to',
  })
  @IsOptional()
  @IsInt()
  replyToId?: number;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Client-side ID for idempotency',
  })
  @IsNotEmpty()
  @IsString()
  tempId: string;
}
