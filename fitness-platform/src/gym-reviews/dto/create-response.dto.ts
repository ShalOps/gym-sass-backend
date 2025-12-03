import { IsNotEmpty, IsString } from 'class-validator';

export class CreateResponseDto {
  @IsNotEmpty()
  @IsString()
  @IsString()
  message: string;
}
