import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  Length,
} from 'class-validator';
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
  @Length(1, 500)
  query: string;

  @ApiPropertyOptional({
    description: 'Maximum number of search results to return',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number = 10;
}
