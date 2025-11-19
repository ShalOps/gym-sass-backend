import { IsOptional, IsIn, IsString } from 'class-validator';
import { DateRangeDto } from './date-range.dto';

export class BookingStatsQueryDto extends DateRangeDto {
  @IsOptional()
  @IsString()
  gymId?: string;

  @IsOptional()
  @IsString()
  userId?: string;


  @IsOptional()
  @IsIn(['monthly', 'weekly', 'daily'])
  range?: 'monthly' | 'weekly' | 'daily';
}
