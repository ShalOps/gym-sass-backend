import { IsOptional, IsISO8601, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DateRangeDto {
  @ApiPropertyOptional({ 
    description: 'Filter analytics by Gym ID',
    example: 1,
    type: Number 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  gymId?: number;

  @ApiPropertyOptional({ 
    description: 'Start date for filtering (ISO8601)',
    example: '2023-10-01T00:00:00Z',
    type: String
  })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ 
    description: 'End date for filtering (ISO8601)',
    example: '2023-10-31T23:59:59Z',
    type: String
  })
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}