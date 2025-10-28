import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Email for login', required: false })
  @IsOptional() @IsEmail() email?: string;

  @ApiProperty({ description: 'Phone number for login', required: false })
  @IsOptional() phoneNo?: string;

  @ApiProperty({ description: 'Password' })
  @IsNotEmpty() password: string;
}
