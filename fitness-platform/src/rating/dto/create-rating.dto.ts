import { IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRatingDto {
  @ApiProperty({ example: 1, description: 'The ID of the product' })
  @IsInt()
  productId: number;

  @ApiProperty({
    example: 'A number from 1 to 5',
    description: 'rating given for the product',
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}
