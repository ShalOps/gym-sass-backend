import { IsString, IsEmail, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { Gender, Goal, Role } from '@prisma/client';

export class CreateUsersDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  userName: string;

  @IsString()
  password: string;

  @IsDateString()
  birthDate: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phoneNo?: string;

  @IsOptional()
  @IsString()
  profilePic?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsString()
  location: string;

  @IsOptional()
  @IsEnum(Goal)
  goal?: Goal;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}