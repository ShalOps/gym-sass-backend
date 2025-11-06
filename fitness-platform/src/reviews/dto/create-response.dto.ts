import { IsString } from 'class-validator';

export class CreateResponseDto {
  @IsString()
  message: string;
}
