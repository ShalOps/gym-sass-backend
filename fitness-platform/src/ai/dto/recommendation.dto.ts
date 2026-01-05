import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  Length,
  ArrayMaxSize,
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
  @ArrayMaxSize(3)
  categories?: string[];

  @ApiPropertyOptional({
    description: 'Optional location filter',
    example: 'Addis Ababa',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  location?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of recommendations to return',
    example: 5,
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number = 5;
}
