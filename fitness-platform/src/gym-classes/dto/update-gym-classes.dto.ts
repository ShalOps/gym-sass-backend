import { CreateGymClassesDto } from "./create-gym-classes.dto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateGymClassesDto extends PartialType(CreateGymClassesDto){}
