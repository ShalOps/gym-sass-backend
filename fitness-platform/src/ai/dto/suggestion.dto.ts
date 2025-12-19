import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
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
  @IsString()
  @IsEnum(['gym', 'class', 'trainer'])
  type: 'gym' | 'class' | 'trainer';

  @ApiPropertyOptional({
    description: 'Optional location filter',
    example: 'Addis Ababa',
  })
  @IsOptional()
  @IsString()
  location?: string;
}
