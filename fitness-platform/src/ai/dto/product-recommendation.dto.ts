import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductRecommendationRequestDto {
  @ApiProperty({
    description: 'The user ID requesting product recommendations',
    example: '123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    description: 'Optional fitness goals to base recommendations on',
    example: ['weightloss', 'muscle-gain'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  goals?: string[];
}
