import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateGymClassReviewDto {
  @ApiPropertyOptional({ example: 5, description: 'Updated rating from 1 to 5' })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @ApiPropertyOptional({ example: 'Trainer was amazing today!' })
  @IsString()
  @IsOptional()
  comment?: string;
}
