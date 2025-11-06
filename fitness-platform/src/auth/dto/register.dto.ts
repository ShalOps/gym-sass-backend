import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsIn,
  MinLength,
} from 'class-validator';
import { Gender, Goal, Role } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiProperty({
    description: 'Unique username',
    example: 'johndoe123',
  })
  @IsNotEmpty()
  @IsString()
  userName: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'johndoe@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Password (will be hashed)',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    description: 'Birth date in ISO format (YYYY-MM-DD)',
    example: '1990-05-15',
  })
  @IsNotEmpty()
  birthDate: Date | string;

  @ApiProperty({
    description: 'User gender',
    enum: Gender,
    example: Gender.MALE,
  })
  @IsNotEmpty()
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({
    description: 'User location at the given time ',
    example: 'GPS Coordinates',
  })
  @IsNotEmpty()
  @IsString()
  location: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phoneNo: string;

  @ApiPropertyOptional({
    description: 'User role (defaults to CUSTOMER)',
    enum: Role,
    example: Role.CUSTOMER,
    default: Role.CUSTOMER,
  })
  @IsOptional()
  @IsEnum(Role)
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    description: 'Fitness goal',
    enum: Goal,
    example: Goal.WEIGHTLOSS,
  })
  @IsOptional()
  @IsEnum(Goal)
  goal?: Goal;

  @ApiPropertyOptional({
    description: 'URL to profile picture',
    example: '/profiles/john.jpg',
  })
  @IsOptional()
  @IsString()
  profilePic?: string;

  @ApiPropertyOptional({
    description: 'Short bio or description',
    example: 'Fitness enthusiast ',
  })
  @IsOptional()
  @IsString()
  bio?: string;
}
