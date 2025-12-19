import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecommendationRequestDto {
  @ApiProperty({
    description: 'The user ID requesting recommendations',
    example: '123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    description: 'Optional categories to filter recommendations',
    example: ['gym', 'trainer'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({
    description: 'Optional location filter',
    example: 'Addis Ababa',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of recommendations to return',
    example: 5,
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  limit?: number = 5;
}
