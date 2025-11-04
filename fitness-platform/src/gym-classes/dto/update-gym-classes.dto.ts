import { CreateGymClassesDto } from "./create-gym-classes.dto";
import { PartialType } from "@nestjs/swagger";

export class UpdateGymClassesDto extends PartialType(CreateGymClassesDto){}
