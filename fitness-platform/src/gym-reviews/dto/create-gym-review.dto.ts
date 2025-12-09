import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    example: 5,
    minimum: 1,
    maximum: 5,
    description: 'Rating for the gym (1-5)',
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    example: 'Great gym!',
    description: 'Optional comment about the gym',
  })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiProperty({ example: 123, description: 'ID of the gym being reviewed' })
  @IsInt()
  gymId: number;

  @ApiPropertyOptional({
    description: 'Dummy field for validation, not required',
  })
  @ValidateIf((o: CreateReviewDto) => !o.comment && !o.rating)
  @IsNotEmpty({ message: 'At least one of rating or comment must be provided' })
  dummy?: any;
}
