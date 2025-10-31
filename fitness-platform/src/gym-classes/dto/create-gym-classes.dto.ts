import { IsString, IsNumber, IsInt, Min } from 'class-validator';

export class CreateGymClassesDto {
  @IsString()
  className: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  classSchedule: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsString()
  duration: string;

  @IsInt()
  gymId: number;

  @IsInt()
  trainerId: number;
}