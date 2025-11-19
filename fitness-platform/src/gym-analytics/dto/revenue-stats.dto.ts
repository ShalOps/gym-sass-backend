import { IsOptional, IsString } from 'class-validator';
import { DateRangeDto } from './date-range.dto';

export class RevenueStatsQueryDto extends DateRangeDto {
  @IsOptional()
  @IsString()
  gymId?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}
