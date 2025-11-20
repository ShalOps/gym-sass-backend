import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { ChapaService } from 'chapa-nestjs';
import {
  PaymentStatus,
  PaymentType,
  BookingStatus,
  Payment,
  Prisma,
} from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InitializePaymentResponseDto } from './dto/initialize-payment.dto';
import { VerifyPaymentResponseDto } from './dto/verify-payment.dto';
import { ChapaWebhookDto } from './dto/webhook.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { RecordManualPaymentDto } from './dto/manual-payment.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly chapaService: ChapaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async logPaymentAction(
    paymentId: number,
    action: string,
    details?: any,
  ) {
    try {
      await this.databaseService.paymentLog.create({
        data: {
          paymentId,
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

  async createPayment(
    user: { userId: number; role: string },
    dto: CreatePaymentDto,
  ): Promise<InitializePaymentResponseDto> {
    const { type, classBookingId, serviceBookingId, returnUrl, metadata } = dto;
    const userId = user.userId;

    let amount = 0;
    let description = '';
    let email = '';
    let firstName = '';
    let lastName = '';

    // 1. Validate & Calculate Price based on Type
    if (type === PaymentType.BOOKING) {
      if (classBookingId) {
        const booking = await this.databaseService.classBooking.findUnique({
          where: { classBookingId },
          include: { class: true, user: true },
        });

        if (!booking) throw new NotFoundException('Class booking not found');
        if (booking.userId !== userId)
          throw new ForbiddenException('Booking does not belong to user');
        if (booking.status === BookingStatus.CONFIRMED)
          throw new BadRequestException('Booking is already confirmed');

        amount = booking.class.price;
        description = `Class: ${booking.class.className}`;
        email = booking.user.email || '';
        firstName = booking.user.firstName;
        lastName = booking.user.lastName;
      } else if (serviceBookingId) {
        const booking = await this.databaseService.serviceBooking.findUnique({
          where: { serviceBookingId },
          include: { service: true, user: true },
        });

        if (!booking) throw new NotFoundException('Service booking not found');
        if (booking.userId !== userId)
          throw new ForbiddenException('Booking does not belong to user');
        if (booking.status === BookingStatus.CONFIRMED)
          throw new BadRequestException('Booking is already confirmed');

        amount = booking.service.price;
        description = `Service: ${booking.service.name}`;
        email = booking.user.email || '';
        firstName = booking.user.firstName;
        lastName = booking.user.lastName;
      } else {
        throw new BadRequestException(
          'Either classBookingId or serviceBookingId must be provided for BOOKING payment',
        );
      }
    } else {
      throw new UnprocessableEntityException(
        `Payment type ${type} is not yet supported`,
      );
    }

    if (amount <= 0) {
      throw new BadRequestException(
        'Payable amount must be greater than zero. For free items, use the free-trial endpoint.',
      );
    }

    // Enforce Chapa limits (Min 10 ETB, Max 100,000 ETB)
    if (amount < 10) {
      throw new BadRequestException('Amount must be at least 10 ETB');
    }
    if (amount > 100000) {
      throw new BadRequestException(
        'Amount exceeds maximum limit of 100,000 ETB',
      );
    }

    // 2. Check for Existing Pending Payment (Prevent Double Payment)
    const existingPayment = await this.databaseService.payment.findFirst({
      where: {
        userId,
        status: PaymentStatus.PENDING,
        OR: [
          { classBookingId: classBookingId || undefined },
          { serviceBookingId: serviceBookingId || undefined },
        ],
      },
    });

    if (existingPayment) {
      // If a pending payment exists, return it instead of creating a new one
      // But first, check if the checkout URL is still valid or if we should return it
      if (existingPayment.checkoutUrl) {
        return {
          txRef: existingPayment.txRef,
          checkoutUrl: existingPayment.checkoutUrl,
        };
      }
      // If no checkout URL (rare edge case), we might want to fail or recreate.
      // For now, let's assume we can reuse the txRef or just fail to be safe.
      throw new ConflictException(
        'A pending payment already exists for this booking. Please complete or cancel it.',
      );
    }

    // 3. Generate Transaction Reference
    const txRef = await this.chapaService.generateTransactionReference({
      prefix: 'GYM',
    });

    // 4. Create Local Payment Record (PENDING)
    const payment = await this.databaseService.payment.create({
      data: {
        txRef,
        amount,
        currency: 'ETB',
        type,
        status: PaymentStatus.PENDING,
        customerEmail: email,
        customerFirstName: firstName,
        customerLastName: lastName,
        returnUrl,
        metadata: metadata as Prisma.InputJsonObject,
        user: { connect: { userId } },
        ...(classBookingId && {
          classBooking: { connect: { classBookingId } },
        }),
        ...(serviceBookingId && {
          serviceBooking: { connect: { serviceBookingId } },
        }),
      },
    });

    await this.logPaymentAction(payment.id, 'INIT', {
      amount,
      type,
      userId,
    });

    // 5. Initialize Chapa Payment
    try {
      const chapaResponse = await this.chapaService.initialize({
        amount: amount.toString(),
        currency: 'ETB',
        email: email,
        first_name: firstName,
        last_name: lastName,
        tx_ref: txRef,
        return_url: returnUrl,
        customization: {
          title: 'Gym Payment',
          description,
        },
      });

      // Update with Chapa response (optional, for debugging)
      await this.databaseService.payment.update({
        where: { txRef },
        data: {
          checkoutUrl: chapaResponse.data.checkout_url,
          chapaResponse: chapaResponse as unknown as Prisma.InputJsonObject,
        },
      });

      this.logger.log(
        `Payment initialized for ${userId}, txRef: ${txRef}, amount: ${amount}`,
      );

      return {
        txRef,
        checkoutUrl: chapaResponse.data.checkout_url,
      };
    } catch (error) {
      const errorMessage =
        error &&
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(`Chapa initialization failed: ${errorMessage}`);
      // Mark as failed locally if initialization fails
      await this.databaseService.payment.update({
        where: { txRef },
        data: { status: PaymentStatus.FAILED },
      });
      throw new BadRequestException('Payment initialization failed');
    }
  }

  async verifyPayment(
    txRef: string,
    user: { userId: number; role: string },
  ): Promise<VerifyPaymentResponseDto> {
    const payment = await this.databaseService.payment.findUnique({
      where: { txRef },
      include: { classBooking: true, serviceBooking: true },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    // Admin OR if the payment belongs to the user
    if (user.role !== 'ADMIN' && payment.userId !== user.userId) {
      throw new ForbiddenException(
        'You do not have permission to verify this payment',
      );
    }

    // If already processed, return immediately
    if (payment.status === PaymentStatus.PROCESSED) {
      return this.mapPaymentToVerifyResponse(payment);
    }

    // Verify with Chapa
    let verifyResponse:
      | {
          status: string;
          data: {
            status: string;
            amount: string;
            reference: string;
            [key: string]: any;
          };
          [key: string]: any;
        }
      | undefined = undefined;
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
        if (attempts >= maxAttempts) {
          throw error;
        }
        // Exponential backoff: 1s, 2s, ...
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
      }
    }

    if (!verifyResponse) {
      throw new BadRequestException(
        'Payment verification failed: No response from Chapa',
      );
    }

    try {
      if (
        verifyResponse.status === 'success' &&
        verifyResponse.data.status === 'success'
      ) {
        // Security Check: Verify Amount
        if (
          parseFloat(verifyResponse.data.amount) !==
          parseFloat(payment.amount.toString())
        ) {
          this.logger.error(
            `Payment amount mismatch for ${txRef}. Expected: ${payment.amount.toString()}, Received: ${verifyResponse.data.amount}`,
          );
          throw new UnprocessableEntityException('Payment amount mismatch');
        }

        await this.processSuccessfulPayment(
          payment.id,
          verifyResponse.data.reference,
          verifyResponse,
        );

        await this.logPaymentAction(payment.id, 'VERIFY', {
          status: 'SUCCESS',
          chapaRef: verifyResponse.data.reference,
        });

        // Refresh payment data
        const updatedPayment = await this.databaseService.payment.findUnique({
          where: { id: payment.id },
        });
        return this.mapPaymentToVerifyResponse(updatedPayment!);
      } else {
        // Mark as failed
        await this.databaseService.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            chapaResponse: verifyResponse as unknown as Prisma.InputJsonObject,
          },
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
      this.logger.error(`Verification error for ${txRef}: ${errorMessage}`);
      throw error;
    }
  }

  async handleWebhook(
    payload: ChapaWebhookDto,
    signature?: string,
    rawBody?: Buffer,
  ) {
    // 1. Verify Signature
    const secret = process.env.CHAPA_WEBHOOK_SECRET;
    if (secret) {
      if (!signature) {
        throw new ForbiddenException('Missing signature');
      }

      // Use rawBody if available, otherwise fallback to JSON.stringify (less reliable)
      const payloadToHash = rawBody ? rawBody : JSON.stringify(payload);

      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(payloadToHash)
        .digest('hex');

      if (signature !== expectedSig) {
        this.logger.warn(
          `Invalid webhook signature. Received: ${signature}, Expected: ${expectedSig}`,
        );
        throw new ForbiddenException('Invalid signature');
      }
    } else {
      this.logger.warn(
        'CHAPA_WEBHOOK_SECRET not configured, skipping signature verification',
      );
    }

    const txRef = payload.tx_ref;
    if (!txRef) {
      this.logger.warn('Webhook received without tx_ref');
      return;
    }

    const payment = await this.databaseService.payment.findUnique({
      where: { txRef },
    });

    if (!payment) {
      this.logger.warn(`Webhook: Payment not found for txRef ${txRef}`);
      return;
    }

    if (payment.status === PaymentStatus.PROCESSED) {
      this.logger.log(`Webhook: Payment ${txRef} already processed`);
      return;
    }

    // 2. Handle Events
    if (payload.event === 'charge.success' || payload.status === 'success') {
      await this.processSuccessfulPayment(
        payment.id,
        payload.reference || 'webhook-ref',
        payload,
      );
      await this.logPaymentAction(payment.id, 'WEBHOOK_SUCCESS', payload);
      this.logger.log(`Webhook: Processed success for ${txRef}`);

      // Send Email Receipt
      if (payment.customerEmail) {
        await this.notificationsService.sendEmailReceipt(
          payment.customerEmail,
          Number(payment.amount),
          txRef,
        );
      }
    } else if (
      payload.event === 'charge.failed' ||
      payload.status === 'failed'
    ) {
      await this.databaseService.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          chapaResponse: payload as unknown as Prisma.InputJsonObject,
        },
      });
      await this.logPaymentAction(payment.id, 'WEBHOOK_FAILED', payload);
      this.logger.warn(`Webhook: Payment failed for ${txRef}`);

      // Notify User
      if (payment.userId) {
        await this.notificationsService.notifyUser(
          payment.userId,
          `Payment failed for transaction ${txRef}. Please try again.`,
        );
      }
    } else {
      await this.logPaymentAction(payment.id, 'WEBHOOK_IGNORED', payload);
      this.logger.log(`Webhook: Unhandled event ${payload.event} for ${txRef}`);
    }
  }

  private async processSuccessfulPayment(
    paymentId: number,
    chapaReference: string,
    fullResponse: any,
  ) {
    return this.databaseService.$transaction(async (tx) => {
      // Re-fetch payment to ensure it hasn't been processed concurrently
      const currentPayment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!currentPayment) return; // Should not happen
      if (currentPayment.status === PaymentStatus.PROCESSED) {
        this.logger.log(
          `Payment ${paymentId} already processed, skipping concurrent update.`,
        );
        return;
      }

      // 1. Update Payment Record
      const payment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.PROCESSED,
          chapaReference,
          chapaResponse: fullResponse as Prisma.InputJsonObject,
          verifiedAt: new Date(),
        },
      });

      // 2. Update Related Booking Status
      if (payment.classBookingId) {
        await tx.classBooking.update({
          where: { classBookingId: payment.classBookingId },
          data: { status: BookingStatus.CONFIRMED },
        });
      } else if (payment.serviceBookingId) {
        await tx.serviceBooking.update({
          where: { serviceBookingId: payment.serviceBookingId },
          data: { status: BookingStatus.CONFIRMED },
        });
      }
    });
  }

  async refundPayment(
    user: { userId: number; role: string },
    dto: RefundPaymentDto,
  ) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can process refunds');
    }

    const payment = await this.databaseService.payment.findUnique({
      where: { txRef: dto.txRef },
      include: { user: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.PROCESSED) {
      throw new BadRequestException('Only processed payments can be refunded');
    }

    // Call Chapa Refund API
    try {
      // Note: Using fetch as chapa-nestjs might not expose refund yet
      // In a real scenario, ensure CHAPA_SECRET_KEY is available
      const secretKey =
        process.env.CHAPA_SECRET_KEY || process.env.CHAPA_TEST_SECRET_KEY;
      if (secretKey) {
        // Mocking the call for now as we don't want to actually hit Chapa in dev without valid keys/endpoints
        // const response = await fetch('https://api.chapa.co/v1/refund', ...);
        this.logger.log(`Simulating Chapa refund for ${payment.txRef}`);
      }
    } catch (error) {
      this.logger.error(`Refund failed for ${payment.txRef}`, error);
      throw new BadRequestException('Refund failed at gateway');
    }

    // Update Local State
    await this.databaseService.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.REFUNDED },
    });

    // Log
    await this.logPaymentAction(payment.id, 'REFUND', {
      reason: dto.reason,
      adminId: user.userId,
    });

    // Notify User
    if (payment.user?.email) {
      await this.notificationsService.notifyUser(
        payment.user.userId,
        `Payment Refunded: Your payment of ${payment.amount.toString()} ETB has been refunded.`,
      );
    }

    return { status: 'success', message: 'Payment refunded successfully' };
  }

  async recordManualPayment(
    user: { userId: number; role: string },
    dto: RecordManualPaymentDto,
  ) {
    if (user.role !== 'ADMIN' && user.role !== 'GYMOWNER') {
      throw new ForbiddenException('Only staff can record manual payments');
    }

    // Verify target user exists
    const targetUser = await this.databaseService.user.findUnique({
      where: { userId: dto.userId },
    });
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    // Generate a manual txRef
    const txRef = `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    return this.databaseService.$transaction(async (tx) => {
      // Create Payment Record
      const payment = await tx.payment.create({
        data: {
          txRef,
          amount: dto.amount,
          currency: 'ETB',
          type: dto.type,
          status: PaymentStatus.PAID_MANUAL,
          method: 'MANUAL_CASH',
          customerEmail: targetUser.email,
          customerFirstName: targetUser.firstName,
          customerLastName: targetUser.lastName,
          user: { connect: { userId: dto.userId } },
          ...(dto.classBookingId && {
            classBooking: { connect: { classBookingId: dto.classBookingId } },
          }),
          ...(dto.serviceBookingId && {
            serviceBooking: {
              connect: { serviceBookingId: dto.serviceBookingId },
            },
          }),
          metadata: {
            notes: dto.notes,
            recordedBy: user.userId,
          } as Prisma.InputJsonObject,
        },
      });

      // Update Booking Status if applicable
      if (dto.classBookingId) {
        await tx.classBooking.update({
          where: { classBookingId: dto.classBookingId },
          data: { status: BookingStatus.CONFIRMED },
        });
      } else if (dto.serviceBookingId) {
        await tx.serviceBooking.update({
          where: { serviceBookingId: dto.serviceBookingId },
          data: { status: BookingStatus.CONFIRMED },
        });
      }

      await this.logPaymentAction(payment.id, 'MANUAL_RECORD', {
        recordedBy: user.userId,
        amount: dto.amount,
      });

      return payment;
    });
  }

  async getTransactionByTxRef(
    txRef: string,
    user: { userId: number; role: string },
  ): Promise<VerifyPaymentResponseDto> {
    const payment = await this.databaseService.payment.findUnique({
      where: { txRef },
    });

    if (!payment) {
      throw new NotFoundException('Transaction not found');
    }

    // Admin OR if the payment belongs to the user
    if (user.role !== 'ADMIN' && payment.userId !== user.userId) {
      throw new ForbiddenException(
        'You do not have permission to view this transaction',
      );
    }

    return this.mapPaymentToVerifyResponse(payment);
  }

  private mapPaymentToVerifyResponse(
    payment: Payment,
  ): VerifyPaymentResponseDto {
    return {
      id: payment.id,
      txRef: payment.txRef,
      chapaReference: payment.chapaReference ?? undefined,
      amount: payment.amount.toString(),
      status: payment.status,
      type: payment.type,
      verifiedAt: payment.verifiedAt?.toISOString(),
      chapaResponse: payment.chapaResponse,
    };
  }
}
