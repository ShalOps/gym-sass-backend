import { Category } from "@prisma/client";
import { IsEnum, IsString, MaxLength } from "class-validator";

export class SpecializationDto {
  @IsEnum(Category)
  category: Category;

  @IsString()
  @MaxLength(50)
  detail: string;
}