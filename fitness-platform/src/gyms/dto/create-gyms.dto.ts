import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class CreateGymsDto {
  @IsString()
  gymName: string;

  @IsOptional()
  @IsString()
  contactNo?: string;

  @IsString()
  location: string;

  @IsOptional()
  @IsString()
  workingHours?: string;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsInt()
  gymOwnerId: number;
}

export class UpdateGymDto {
  @IsOptional()
  @IsString()
  gymName?: string;

  @IsOptional()
  @IsString()
  contactNo?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  workingHours?: string;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;
}

export class PaginationDto {
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsInt()
  @Min(1)
  limit: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  workingHours?: string;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsInt()
  gymOwnerId?: number;
}