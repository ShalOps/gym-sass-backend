import { IsString } from 'class-validator';

export class UserActivityParamsDto {
  @IsString()
  userId: string;
}
