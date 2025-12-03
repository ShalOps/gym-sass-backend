import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateGymClassReviewResponseDto {
  @ApiPropertyOptional({
    example: 'We appreciate your review and look forward to seeing you again!',
  })
  @IsString()
  @IsOptional()
  message?: string;
}
