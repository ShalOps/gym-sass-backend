import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateGymClassReviewDto {
  @ApiProperty({ example: 4, description: 'Rating from 1 to 5' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    example: 'Great class, very energetic trainer!',
    required: false,
  })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiProperty({
    example: 1,
    description: 'The ID of the gym class being reviewed',
  })
  @IsInt()
  classId: number;
}
