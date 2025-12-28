import { BadRequestException, Injectable, Logger, NotFoundException, GatewayTimeoutException, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OrderStatus } from '@prisma/client';
import { PaymentMarketPlaceService } from 'src/payments/payments-marketplace.service';
import { PaymentType, Prisma } from '@prisma/client';



@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  
  constructor(
    private readonly databaseService: DatabaseService, 
    private readonly paymentMarketPlaceService: PaymentMarketPlaceService
  ) {}


async retryPayment(userId: number, orderId: number, returnUrl: string) {
  const order = await this.databaseService.order.findUnique({
    where: { id: orderId },
    include: { user: true }
  });

  if (!order) throw new NotFoundException('Order not found');
  if (order.userId !== userId) throw new ForbiddenException('Not your order');
  if (order.status === OrderStatus.PAID) throw new BadRequestException('Order already paid');

  return await this.paymentMarketPlaceService.initializePaymentOrder(
    { userId, role: order.user.role },
    {
      amount: Number(order.totalAmount),
      currency: 'ETB',
      email: order.user.email,
      firstName: order.user.firstName,
      lastName: order.user.lastName,
      returnUrl: returnUrl,
      orderId: order.id,
      metadata: { orderId: order.id },
    }
  );
}

async create(userId: number, returnUrl: string) {
    const cart = await this.databaseService.cart.findUnique({
      where: { cartOwnerId: userId },
      include: {
        cartItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || cart.cartItems.length === 0) {
      throw new BadRequestException('Please add products to cart first');
    }

    const totalAmount = cart.cartItems.reduce(
      (sum, item) => sum + Number(item.product.price),
      0,
    );

    const transactionStartTime = Date.now();

    try {
      return await this.databaseService.$transaction(
        async (tx) => {
          const order = await tx.order.create({
            data: {
              userId: userId,
              totalAmount: totalAmount,
              status: OrderStatus.PENDING,
              items: {
                create: cart.cartItems.map((item) => ({
                  productId: item.productId,
                  price: item.product.price, 
                })),
              },
            },
          });

          await tx.cartItem.deleteMany({
            where: { cartId: cart.id },
          });

          let paymentResponse;
          
          const user = await this.databaseService.user.findUnique({
            where: { userId },
            select: {
              role: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          });

          if (user) {
            paymentResponse = await this.paymentMarketPlaceService.initializePaymentOrder(
              { userId, role: user.role },
              {
                amount: totalAmount,
                currency: 'ETB',
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                returnUrl: returnUrl,
                metadata: {
                  orderId: order.id, 
                },
                orderId: order.id, 
                type: PaymentType.PURCHASE,
              },
              tx,
            );
          }

          return {
            order,
            payment: paymentResponse as Record<string, unknown> | undefined,
          };
        },
        { timeout: 20000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          this.logger.warn('Order failed: Duplicate order reference');
          throw new BadRequestException('Duplicate order reference.');
        }
      }

      if (
        error instanceof Error &&
        (error.message.includes('Transaction already closed') ||
          error.message.includes('Timed out'))
      ) {
        const elapsed = Date.now() - transactionStartTime;
        const seconds = (elapsed / 1000).toFixed(1);
        throw new GatewayTimeoutException(
          `Payment provider is taking too long to respond (${seconds}s). Please try again.`,
        );
      }

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        'Order transaction failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Order transaction failed');
    }
  }

  async findAll(userId: number) {
    return this.databaseService.order.findMany({
       where: {
        userId,
      }
    })
  }
}

