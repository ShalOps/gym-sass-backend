import { CreateServiceOptionDto } from "./create-service-option.dto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateServiceOptionDto extends PartialType(CreateServiceOptionDto){}





