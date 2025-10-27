import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class LoginDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() phoneNo?: string;
  @IsNotEmpty() password: string;
}
