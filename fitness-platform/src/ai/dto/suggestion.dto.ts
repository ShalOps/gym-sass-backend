import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuggestionRequestDto {
  @ApiProperty({
    description: 'The user ID requesting suggestions',
    example: '123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Type of suggestion to get',
    example: 'gym',
    enum: ['gym', 'class', 'trainer'],
  })
  @IsEnum(['gym', 'class', 'trainer'])
  type: 'gym' | 'class' | 'trainer';

  @ApiPropertyOptional({
    description: 'Optional location filter',
    example: 'Addis Ababa',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  location?: string;
}
