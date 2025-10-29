import { IsEmail, IsNotEmpty, IsString, IsEnum, IsOptional, IsIn, MinLength } from 'class-validator';
import { Gender, Goal, Role } from '@prisma/client';

export class RegisterDto {
  @IsNotEmpty() @IsString() firstName: string;
  @IsNotEmpty() @IsString() lastName: string;
  @IsNotEmpty() @IsString() userName: string;
  @IsEmail() email: string;
  @IsNotEmpty() @IsString() @MinLength(8) password: string;
  @IsNotEmpty() birthDate: Date | string;
  @IsNotEmpty() @IsEnum(Gender) gender: Gender;
  @IsNotEmpty() @IsString() location: string;
  @IsNotEmpty() @IsString() phoneNo: string;
  @IsOptional()
  @IsEnum(Role)
  @IsIn([Role.TRAINER, Role.CUSTOMER, Role.GYMOWNER])
  role?: Role;
  @IsOptional() @IsEnum(Goal) goal?: Goal;
  @IsOptional() @IsString() profilePic?: string;
  @IsOptional() @IsString() bio?: string;
}