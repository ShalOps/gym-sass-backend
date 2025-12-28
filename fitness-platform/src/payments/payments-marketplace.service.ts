import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
  Inject,
  forwardRef,
  HttpException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { ChapaService } from 'chapa-nestjs';
import {
  Payment,
  PaymentStatus,
  PaymentType,
  Prisma,
  BookingStatus,
} from '@prisma/client';
import { InitializePaymentResponseDto } from './dto/initialize-payment.dto';
import { VerifyPaymentResponseDto } from './dto/verify-payment.dto';
import { ChapaWebhookDto } from './dto/webhook.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentMapper } from './payment.mapper';
import { OrderStatus } from '@prisma/client';
import { PaymentService } from './payments.service';

@Injectable()
export class PaymentMarketPlaceService {
    private readonly logger = new Logger(PaymentMarketPlaceService.name);


    constructor(
    private readonly databaseService: DatabaseService,
    private readonly chapaService: ChapaService,
  ) {}

    private async logPaymentAction(
      paymentId: number | undefined | null,
      action: string,
      details?: any,
      tx?: Prisma.TransactionClient,
    ) {
      const db = tx || this.databaseService;
      try {
        await db.paymentLog.create({
          data: {
            paymentId: paymentId ?? null,
            action,
            details: details as Prisma.InputJsonObject,
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to log payment action ${action} for payment ${paymentId}`,
          error,
        );
      }
    }

    private sanitizePaymentError(error: unknown): HttpException {
    if (error instanceof HttpException) {
      this.logger.warn(`Payment operation warning: ${error.message}`);
      return error;
    }

    const errorMessage =
      error &&
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : String(error);

    this.logger.error(`Payment operation failed: ${errorMessage}`, error);

    if (
      errorMessage.includes('email') &&
      errorMessage.includes('valid email address')
    ) {
      return new BadRequestException(
        'Invalid email address provided. Please correct and try again.',
      );
    }

    if (
      errorMessage.includes('Server took forever to respond') ||
      errorMessage.includes('temporarily unavailable')
    ) {
      return new BadRequestException(
        'Payment service temporarily unavailable. Please try again later.',
      );
    }

    if (
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT')
    ) {
      return new BadRequestException(
        'Unable to connect to payment gateway. Please check your internet connection.',
      );
    }

    return new BadRequestException(
      'Payment initialization failed. Please try again or contact support.',
    );
  }

  
  async initializePaymentOrder(
    user: { userId: number; role: string },
    params: {
      amount: number;
      currency: string;
      email: string;
      firstName: string;
      lastName: string;
      returnUrl: string;
      metadata?: Record<string, any>;
      orderId: number; 
      type?: PaymentType;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<InitializePaymentResponseDto> {
    const db = tx || this.databaseService;
    const {
      amount,
      currency,
      email,
      firstName,
      lastName,
      returnUrl,
      metadata,
      orderId, 
      type = PaymentType.PURCHASE, 
    } = params;
    const userId = user.userId;

    if (!email || !email.trim()) {
      throw new BadRequestException('Email is required');
    }

    if (amount <= 0) {
      throw new BadRequestException('Payable amount must be greater than zero');
    }

    if (amount < 10) throw new BadRequestException('Amount must be at least 10 ETB');
    if (amount > 100000) throw new BadRequestException('Amount exceeds limit of 100,000 ETB');

    const order = await db.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('You can only initiate payment for your own orders');
    }

    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('This order has already been paid');
    }


    if (Number(order.totalAmount) !== amount) {
       throw new BadRequestException('Payment amount mismatch with order total');
    }

    let payment = await db.payment.findUnique({
      where: { orderId: orderId },
    });

    if (payment && payment.status === PaymentStatus.PENDING) {
      if (payment.checkoutUrl) {
        return {
          txRef: payment.txRef,
          checkoutUrl: payment.checkoutUrl,
        };
      }
    }

    const txRef = await this.chapaService.generateTransactionReference({
      prefix: 'ORD', 
    });

    if (payment) {
      payment = await db.payment.update({
        where: { id: payment.id },
        data: {
          txRef, 
          amount,
          status: PaymentStatus.PENDING,
          checkoutUrl: null,
          updatedAt: new Date(),
        },
      });
    } else {
      payment = await db.payment.create({
        data: {
          txRef,
          amount,
          currency,
          type,
          status: PaymentStatus.PENDING,
          customerEmail: email,
          customerFirstName: firstName,
          customerLastName: lastName,
          returnUrl,
          metadata: metadata as Prisma.InputJsonObject,
          user: { connect: { userId } },
          order: { connect: { id: orderId } }, 
        },
      });
    }

    await this.logPaymentAction(
      payment.id,
      'INIT',
      { amount, type, userId, orderId },
      db,
    );

    try {
      const separator = returnUrl.includes('?') ? '&' : '?';
      const returnUrlWithRef = `${returnUrl}${separator}tx_ref=${txRef}`;

      const chapaResponse = await this.chapaService.initialize({
        amount: amount.toString(),
        currency,
        email: email.trim(),
        first_name: firstName,
        last_name: lastName,
        tx_ref: txRef,
        return_url: returnUrlWithRef,
        customization: {
          title: `Order-${orderId}`,
          description: `Payment for Order ${orderId}`,
        },
      });

      await db.payment.update({
        where: { id: payment.id }, 
        data: {
          checkoutUrl: chapaResponse.data.checkout_url,
          chapaResponse: chapaResponse as unknown as Prisma.InputJsonObject,
        },
      });

      this.logger.log(`Payment initialized for Order #${orderId}, txRef: ${txRef}`);

      return {
        txRef,
        checkoutUrl: chapaResponse.data.checkout_url,
      };

    } catch (error) {
      try {
        await db.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.FAILED },
        });
      } catch { /* Ignore update errors during rollback */ }

      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.logPaymentAction(
        undefined,
        'INIT_FAILED',
        { error: errorMessage, txRef, userId, orderId },
        this.databaseService,
      );

      throw this.sanitizePaymentError(error);
    }
  }

  async verifyPayment(
    txRef: string,
    user: { userId: number; role: string },
  ): Promise<VerifyPaymentResponseDto> {
    const payment = await this.databaseService.payment.findUnique({
      where: { txRef },
      include: { 
        order: true 
      },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    if (user.role !== 'ADMIN' && payment.userId !== user.userId) {
      throw new ForbiddenException(
        'You do not have permission to verify this payment',
      );
    }

    if (payment.status === PaymentStatus.PROCESSED) {
      return PaymentMapper.toVerifyResponse(payment);
    }

    let verifyResponse: any = undefined;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        verifyResponse = await this.chapaService.verify({ tx_ref: txRef });
        break;
      } catch (error) {
        attempts++;
        this.logger.warn(
          `Verification attempt ${attempts} failed for ${txRef}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        if (attempts >= maxAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
      }
    }

    if (!verifyResponse) {
      throw new BadRequestException(
        'Payment verification failed: No response from Chapa',
      );
    }

    const result = await this._verifyAndProcess(
      payment,
      verifyResponse
    );

    return result.dto;
  }


  async _verifyAndProcess(
      payment: Payment,
      verifyResponse: {
        status: string;
        data: {
          status: string;
          amount: number | string;
          reference: string;
          payment_method?: string;
        };
      },
    ) {
   
      try {
        if (
          verifyResponse.status === 'success' &&
          verifyResponse.data.status === 'success'
        ) {
          const chapaAmount = Number(verifyResponse.data.amount).toFixed(2);
          const dbAmount = Number(payment.amount).toFixed(2);
  
          if (chapaAmount !== dbAmount) {
            this.logger.error(
              `Payment amount mismatch for ${payment.txRef}. Expected: ${dbAmount}, Received: ${chapaAmount}`,
            );
            throw new UnprocessableEntityException('Payment amount mismatch');
          }
  
          const processed = await this.processSuccessfulPayment(
            payment.id,
            verifyResponse.data.reference,
            verifyResponse,
          );
  
          if (processed) {
            await this.logPaymentAction(payment.id, 'VERIFY', {
              status: 'SUCCESS',
              chapaRef: verifyResponse.data.reference,
            });
          }
  
          const updatedPayment = await this.databaseService.payment.findUnique({
            where: { id: payment.id },
          });
          return {
            processed,
            dto: PaymentMapper.toVerifyResponse(updatedPayment!),
          };
        } else {
          await this.databaseService.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.FAILED,
              chapaResponse: verifyResponse as unknown as Prisma.InputJsonObject,
            },
          });
  
          await this.logPaymentAction(payment.id, 'VERIFY_FAILED', {
            chapaResponse: verifyResponse,
          });
  
          throw new BadRequestException('Payment verification failed at gateway');
        }
      } catch (error) {
        const errorMessage =
          error &&
          typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message
            : String(error);
        this.logger.error(
          `Verification error for ${payment.txRef}: ${errorMessage}`,
        );
        throw error;
      }
    }
  

  private async processSuccessfulPayment(
    paymentId: number,
    chapaReference: string,
    fullResponse: any,
  ) {
    return await this.databaseService.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.PROCESSED,
          chapaReference,
          chapaResponse: fullResponse as unknown as Prisma.InputJsonObject,
        },
        include: {
          order: {
            include: {
              items: true, 
            },
          },
        },
      });

      if (updatedPayment.orderId) {
        await tx.order.update({
          where: { id: updatedPayment.orderId }, 
          data: {
            status: OrderStatus.PAID, 
          },
        });
        
        this.logger.log(`Order #${updatedPayment.orderId} marked as PAID`);

        if (!updatedPayment.userId || !updatedPayment.order) {
          throw new Error('Cannot fulfill digital items: Missing User or Order data');
        }

        const fulfillmentPromises = updatedPayment.order.items.map((item) => {
        return tx.purchasedItem.upsert({
          where: {
            userId_productId: {
              userId: updatedPayment.userId as number,
              productId: item.productId,
            },
          },
          update: {}, 
          create: {
            userId: updatedPayment.userId as number,
            productId: item.productId,
            orderId: updatedPayment.orderId!,
          },
        });
      });

      await Promise.all(fulfillmentPromises);
      this.logger.log(`Order #${updatedPayment.orderId} fulfilled to User Library`);
    }

      return true;
    });
  }
}