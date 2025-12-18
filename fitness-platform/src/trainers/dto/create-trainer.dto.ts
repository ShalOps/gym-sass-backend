import { IsString, IsNumber, IsOptional, IsArray, IsBoolean, IsDate } from 'class-validator';

export class CreateTrainerDto {
  userId: number;
  
  @IsOptional()
  bio?: string;

  @IsOptional()
  gender?: string;

  @IsOptional()
  dob?: Date;

  @IsOptional()
  hourlyRate?: number;

  @IsOptional()
  specializations?: object[];

  @IsOptional()
  yearsOfExperience?: number;

  @IsOptional()
  verified?: boolean;
}
