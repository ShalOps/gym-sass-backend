import { CreateServiceDto } from "./create-services.dto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateServiceDto extends PartialType(CreateServiceDto){}




