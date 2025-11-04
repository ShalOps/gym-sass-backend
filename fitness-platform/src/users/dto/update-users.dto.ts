import { CreateUsersDto } from "./create-users.dto";
import { PartialType } from "@nestjs/swagger";

export class UpdateUsersDto extends PartialType(CreateUsersDto){}