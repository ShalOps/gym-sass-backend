import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, Min, IsISO8601 } from 'class-validator';

export class AdminAnalyticsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsPositive()
  limit?: number = 10;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Transform(({ value }: { value: string | number | Date }) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (isNaN(date.getTime())) return undefined;
    return date.toISOString();
  })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Transform(({ value }: { value: string | number | Date }) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (isNaN(date.getTime())) return undefined;
    return date.toISOString();
  })
  to?: string;
}
