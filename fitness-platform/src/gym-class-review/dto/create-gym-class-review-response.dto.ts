import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

export class CreateGymClassReviewResponseDto {
  @ApiProperty({
    example: 'Thank you for your feedback! We are glad you enjoyed the class.',
  })
  @IsString()
  message: string;
}
