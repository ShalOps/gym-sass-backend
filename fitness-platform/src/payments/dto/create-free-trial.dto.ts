import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

export class CreateFreeTrialDto {
  @ApiProperty({ description: 'ServiceBooking ID for trial' })
  @IsInt()
  serviceBookingId: number;

  @ApiProperty({ description: 'Trial duration in days', example: 14 })
  @IsInt()
  trialDays: number;

  @ApiProperty()
  @IsString()
  returnUrl: string;
}
