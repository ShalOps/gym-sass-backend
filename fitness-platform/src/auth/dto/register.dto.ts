import { IsEmail, IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { Gender, Goal } from '../../../generated/prisma';

export class RegisterDto {
  @IsNotEmpty() @IsString() firstName: string;
  @IsNotEmpty() @IsString() lastName: string;
  @IsNotEmpty() @IsString() userName: string;
  @IsEmail() email: string;
  @IsNotEmpty() @IsString() password: string;
  @IsNotEmpty() birthDate: Date | string;
  @IsNotEmpty() @IsEnum(Gender) gender: Gender;
  @IsNotEmpty() @IsString() location: string;
  @IsOptional()
  @IsEnum(Goal) 
  goal?: Goal;
  @IsOptional() @IsString() phoneNo?: string;
  @IsOptional() @IsString() profilePic?: string;
  @IsOptional() @IsString() bio?: string;
}