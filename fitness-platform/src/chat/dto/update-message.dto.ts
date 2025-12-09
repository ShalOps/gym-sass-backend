import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMessageDto {
  @ApiProperty({
    example: 'Updated message content',
    description: 'New content for the message',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    example: [1, 2],
    description: 'Array of attachment IDs to replace existing ones (optional)',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  attachmentIds?: number[];
}
