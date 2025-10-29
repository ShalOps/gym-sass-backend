import { IsInt } from "class-validator"

export class CreateServiceOptionAssignmentDto {
    
    @IsInt()
    serviceId: number;

    @IsInt()
    optionId: number;

    @IsInt()
    gymId: number;
}
