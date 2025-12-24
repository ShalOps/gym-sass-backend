import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsNumber } from 'class-validator';

export class AIResponseMetadataDto {
  @ApiProperty({
    description: 'Unique request identifier for tracking',
    example: 'req-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  requestId: string;

  @ApiProperty({
    description: 'Response timestamp in ISO format',
    example: '2025-12-24T10:30:00.000Z',
  })
  @IsString()
  timestamp: string;

  @ApiProperty({
    description: 'Processing time in milliseconds',
    example: 150,
  })
  @IsNumber()
  processingTime: number;

  @ApiProperty({
    description: 'AI feature that processed the request',
    example: 'chat',
  })
  @IsString()
  feature: string;

  @ApiProperty({
    description: 'User ID associated with the request',
    example: '123',
  })
  @IsString()
  userId: string;
}

export class AIErrorDto {
  @ApiProperty({
    description: 'Error code for programmatic handling',
    example: 'INVALID_INPUT',
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: 'Human-readable error message',
    example: 'The provided input is invalid',
  })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Additional error details for debugging',
    example: { field: 'message', reason: 'too_long' },
  })
  @IsOptional()
  details?: any;
}

export class AIStandardResponseDto<T = any> {
  @ApiProperty({
    description: 'Whether the request was successful',
    example: true,
  })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'The response data payload (null when success is false)',
    example: { message: 'Hello world' },
    nullable: true,
  })
  data: T | null;

  @ApiProperty({
    description: 'Request metadata for tracking and debugging',
  })
  metadata: AIResponseMetadataDto;

  @ApiPropertyOptional({
    description: 'Error information (only present when success is false)',
  })
  @IsOptional()
  error?: AIErrorDto;
}
