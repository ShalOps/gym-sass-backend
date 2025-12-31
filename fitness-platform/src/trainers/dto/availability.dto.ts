import { IsDateString } from "class-validator";

export class CheckAvailabilityDto {
  @IsDateString()
  date: string;
  
  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;
}