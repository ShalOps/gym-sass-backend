import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateResponseReviewDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  message?: string;
}
