import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateIf } from "class-validator";

export class CreateReviewDto {
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @IsString()
    @IsOptional()
    comment?: string;

    @IsInt()
    gymId: number;

    @ValidateIf(o => !o.comment && !o.rating)
    @IsNotEmpty({ message: 'At least one of rating or comment must be provided' })
    dummy?: any;


}
