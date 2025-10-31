import { CreateGymsDto } from "./create-gyms.dto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateGymsDto extends PartialType(CreateGymsDto){}