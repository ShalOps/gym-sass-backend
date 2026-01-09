import { PartialType } from '@nestjs/swagger';
import { CreateCartDto } from './create-cart.dto';
import { CreateCartItemDto } from './create-cart.dto';

export class UpdateCartDto extends PartialType(CreateCartDto) {}
export class UpdateCartItemDto extends PartialType(CreateCartItemDto) {}
