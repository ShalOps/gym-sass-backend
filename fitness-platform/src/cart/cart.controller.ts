import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards, BadRequestException, Query } from '@nestjs/common';
import { CartService } from './cart.service';
import { CreateCartItemDto } from './dto/create-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private parseCursor(cursor?: string): number | undefined {
    
    if (!cursor) return undefined;
      const parsed = Number(cursor);
    if (isNaN(parsed) || parsed <= 0) {
      throw new BadRequestException('cursor must be a positive number');
    }
    return parsed;
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Add product to cart' })
  @ApiBearerAuth('JWT-auth')
  create(@Body() createCartItemDto: CreateCartItemDto, @Req() req: RequestWithUser) {
    return this.cartService.create(createCartItemDto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get all items in the cart of the user' })
  @ApiBearerAuth('JWT-auth')
  findAll(@Req() req: RequestWithUser, @Query('cursor') cursor?: string) {
    return this.cartService.findAllItemsInCart(req.user.userId, this.parseCursor(cursor));
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':productId')
  @ApiOperation({ summary: 'Delete cart item by providing productId' })
  @ApiBearerAuth('JWT-auth')
  remove(@Param('productId') productId: string, @Req() req: RequestWithUser) {
    return this.cartService.remove(+productId, req.user.userId);
  }
}
