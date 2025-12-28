import { BadRequestException, Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { OrderService } from './order.service';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

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
  @ApiOperation({ summary: 'Add items in cart to order table so that it can be processed' })
  @ApiBearerAuth('JWT-auth')
  create(@Req() req: RequestWithUser, @Body('returnUrl') returnUrl: string) {
    return this.orderService.create(req.user.userId, returnUrl);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all orders of a given user (Pending, Paid, Failed' })
  @Get()
  @ApiBearerAuth('JWT-auth')
  findAll(@Req() req: RequestWithUser, @Query('cursor') cursor?: string) {
    return this.orderService.findAll(req.user.userId, this.parseCursor(cursor));
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/refresh')
  @ApiOperation({ summary: 'Get new Checkout url if the current one is not working' })
  @ApiBearerAuth('JWT-auth')
  async refreshCheckoutUrl(
    @Param('id') orderId: string,
    @Req() req: RequestWithUser,
    @Body('returnUrl') returnUrl: string,
  ) {
    return await this.orderService.retryPayment(req.user.userId, +orderId, returnUrl);
  }


}
