import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchRequestDto {
  @ApiProperty({
    description: 'The user ID performing the search',
    example: '123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'The natural language search query',
    example: 'best gym near me for yoga classes',
  })
  @IsString()
  @IsNotEmpty()
  query: string;

  @ApiPropertyOptional({
    description: 'Maximum number of search results to return',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  limit?: number = 10;
}
