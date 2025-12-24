import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AIFeedbackDto {
  @ApiProperty({
    description: 'User ID',
    example: '123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'AI feature that received feedback',
    example: 'recommendation',
    enum: ['recommendation', 'workout', 'search', 'product', 'suggestion'],
  })
  @IsString()
  @IsNotEmpty()
  feature: string;

  @ApiProperty({
    description: 'Feedback: 1 = thumbs down, 2 = thumbs up',
    example: 2,
    minimum: 1,
    maximum: 2,
  })
  @IsInt()
  @Min(1)
  @Max(2)
  rating: number;
}
