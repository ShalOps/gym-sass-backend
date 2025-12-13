import { IsArray, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ConversationContext } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({
    example: [1, 2],
    description: 'List of user IDs to include in the conversation',
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  participantIds: number[];

  @ApiPropertyOptional({
    enum: ConversationContext,
    description: 'Context of the conversation (e.g., CLASS_INQUIRY)',
  })
  @IsOptional()
  @IsEnum(ConversationContext)
  context?: ConversationContext;

  @ApiPropertyOptional({
    example: 'booking-123',
    description: 'ID of the related entity (e.g., Booking ID)',
  })
  @IsOptional()
  @IsString()
  contextId?: string;

  @ApiPropertyOptional({
    example: 'Group Chat',
    description: 'Title of the conversation (optional)',
  })
  @IsOptional()
  @IsString()
  title?: string;
}
