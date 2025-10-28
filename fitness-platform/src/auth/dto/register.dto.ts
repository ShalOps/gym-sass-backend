import { IsEmail, IsNotEmpty, IsString, IsEnum, IsOptional, IsIn, MinLength } from 'class-validator';
import { Gender, Goal, Role } from '../../../generated/prisma';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'User first name' })
  @IsNotEmpty() @IsString() firstName: string;

  @ApiProperty({ description: 'User last name' })
  @IsNotEmpty() @IsString() lastName: string;

  @ApiProperty({ description: 'Unique username' })
  @IsNotEmpty() @IsString() userName: string;

  @ApiProperty({ description: 'Email address', required: false })
  @IsOptional() @IsEmail() email?: string;

  @ApiProperty({ description: 'Password (min 8 characters)' })
  @IsNotEmpty() @IsString() @MinLength(8) password: string;

  @ApiProperty({ description: 'Birth date' })
  @IsNotEmpty() birthDate: Date | string;

  @ApiProperty({ description: 'User gender', enum: Gender })
  @IsNotEmpty() @IsEnum(Gender) gender: Gender;

  @ApiProperty({ description: 'User location' })
  @IsNotEmpty() @IsString() location: string;

  @ApiProperty({ description: 'Phone number' })
  @IsNotEmpty() @IsString() phoneNo: string;

  @ApiProperty({ description: 'User role', enum: Role, required: false })
  @IsOptional()
  @IsEnum(Role)
  @IsIn([Role.TRAINER, Role.CUSTOMER, Role.GYMOWNER])
  role?: Role;

  @ApiProperty({ description: 'Fitness goal', enum: Goal, required: false })
  @IsOptional() @IsEnum(Goal) goal?: Goal;

  @ApiProperty({ description: 'Profile picture URL', required: false })
  @IsOptional() @IsString() profilePic?: string;

  @ApiProperty({ description: 'User bio', required: false })
  @IsOptional() @IsString() bio?: string;
}