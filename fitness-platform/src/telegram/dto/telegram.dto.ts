import { IsInt, IsString, IsBoolean, IsOptional, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class TelegramUserDto {
  @IsInt()
  id: number;

  @IsBoolean()
  is_bot: boolean;

  @IsString()
  first_name: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  language_code?: string;
}

export class TelegramChatDto {
  @IsInt()
  id: number;

  @IsString()
  type: string; 

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  title?: string;
}

export class TelegramMessageEntityDto {
  @IsInt()
  offset: number;

  @IsInt()
  length: number;

  @IsString()
  type: string; 
}

export class TelegramMessageDto {
  @IsInt()
  message_id: number;

  @ValidateNested()
  @Type(() => TelegramUserDto)
  from: TelegramUserDto;

  @ValidateNested()
  @Type(() => TelegramChatDto)
  chat: TelegramChatDto;

  @IsInt()
  date: number;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TelegramMessageEntityDto)
  entities?: TelegramMessageEntityDto[];

}

export class TelegramUpdateDto {
  @IsInt()
  update_id: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TelegramMessageDto)
  message?: TelegramMessageDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TelegramMessageDto)
  edited_message?: TelegramMessageDto;

  @IsOptional()
  @IsObject()
  callback_query?: any; 

}