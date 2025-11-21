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
import { InitializePaymentResponseDto } from './dto/initialize-payment.dto';
import { VerifyPaymentResponseDto } from './dto/verify-payment.dto';
import { ChapaWebhookDto } from './dto/webhook.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { RecordManualPaymentDto } from './dto/manual-payment.dto';
import { TransactionHistoryDto } from './dto/transaction-history.dto';

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

  async initializePayment(
    user: { userId: number; role: string },
    params: {
      amount: number;
      currency: string;
      email: string;
      firstName: string;
      lastName: string;
      returnUrl: string;
      metadata?: Record<string, any>;
      classBookingId?: number;
      serviceBookingId?: number;
      type?: PaymentType;
    },
  ): Promise<InitializePaymentResponseDto> {
    const {
      amount,
      currency,
      email,
      firstName,
      lastName,
      returnUrl,
      metadata,
      classBookingId,
      serviceBookingId,
      type = PaymentType.BOOKING,
    } = params;
    const userId = user.userId;

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
        currency,
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
        currency,
        email: email.trim(),
        first_name: firstName,
        last_name: lastName,
        tx_ref: txRef,
        return_url: returnUrl,
        customization: {
          title: 'Gym Payment',
          description:
            (metadata &&
            typeof metadata === 'object' &&
            'description' in metadata
              ? (metadata as { description?: string }).description
              : undefined) || 'Payment',
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
        // Normalize to 2 decimal places to avoid floating point issues and format mismatches
        const chapaAmount = Number(verifyResponse.data.amount).toFixed(2);
        const dbAmount = Number(payment.amount).toFixed(2);

        if (chapaAmount !== dbAmount) {
          this.logger.error(
            `Payment amount mismatch for ${txRef}. Expected: ${dbAmount}, Received: ${chapaAmount}`,
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

      // Send Email Receipt (Fire-and-forget)
      if (payment.customerEmail) {
        this.notificationsService
          .sendEmailReceipt(
            payment.customerEmail,
            Number(payment.amount),
            txRef,
          )
          .catch((err) =>
            this.logger.error(
              `Failed to send email receipt for ${txRef}`,
              err instanceof Error ? err.stack : String(err),
            ),
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

      // Notify User (Fire-and-forget)
      if (payment.userId) {
        this.notificationsService
          .notifyUser(
            payment.userId,
            `Payment failed for transaction ${txRef}. Please try again.`,
          )
          .catch((err) =>
            this.logger.error(
              `Failed to notify user ${payment.userId} of failure`,
              err instanceof Error ? err.stack : String(err),
            ),
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

    // 1. Fetch and validate payment from DB
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

    const currentRefunded = Number(payment.refundedAmount || 0);
    const refundAmount = dto.amount || Number(payment.amount) - currentRefunded;

    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }

    if (refundAmount + currentRefunded > Number(payment.amount)) {
      throw new BadRequestException(
        `Refund amount exceeds remaining refundable balance (${
          Number(payment.amount) - currentRefunded
        } ETB)`,
      );
    }

    // 2. Call Chapa Refund API
    try {
      const secretKey =
        process.env.CHAPA_SECRET_KEY || process.env.CHAPA_TEST_SECRET_KEY;

      if (!secretKey) {
        throw new BadRequestException('Chapa keys not configured');
      }

      const chapaBaseUrl =
        process.env.NODE_ENV === 'production'
          ? 'https://api.chapa.co/v1'
          : 'https://sandbox.chapa.co/v1';

      const payload = {
        tx_ref: dto.txRef,
        amount: refundAmount,
        reason: dto.reason || 'User requested refund',
      };

      const response = await fetch(`${chapaBaseUrl}/refund`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData: unknown = await response.json().catch(() => ({}));
        const errorMessage =
          errorData &&
          typeof errorData === 'object' &&
          errorData !== null &&
          'message' in errorData
            ? (errorData as { message?: string }).message
            : response.statusText;
        this.logger.error(
          `Chapa refund failed for ${dto.txRef}: ${errorMessage}`,
        );
        // In dev/sandbox, refund might not be fully supported or might fail if tx is old
        // For now, we'll throw, but in a real app we might want to handle specific error codes
        throw new BadRequestException(
          `Refund failed at gateway: ${
            errorData &&
            typeof errorData === 'object' &&
            errorData !== null &&
            'message' in errorData
              ? (errorData as { message?: string }).message
              : 'Unknown error'
          }`,
        );
      }

      const refundData = (await response.json()) as {
        status: string;
        refund_ref?: string;
        message?: string;
      };
      if (refundData.status !== 'success') {
        throw new BadRequestException(`Refund rejected: ${refundData.message}`);
      }

      this.logger.log(
        `Refund successful for ${dto.txRef}: ${refundData.refund_ref}`,
      );

      // 3. Update Local State
      await this.databaseService.payment.update({
        where: { id: payment.id },
        data: {
          status:
            refundAmount + currentRefunded >= Number(payment.amount)
              ? PaymentStatus.REFUNDED
              : PaymentStatus.PARTIALLY_REFUNDED,
          refundedAmount: currentRefunded + refundAmount,
          refundedAt: new Date(),
        },
      });

      // Log
      await this.logPaymentAction(payment.id, 'REFUND', {
        reason: dto.reason,
        amount: refundAmount,
        adminId: user.userId,
        chapaRefundRef: refundData.refund_ref,
      });

      // Notify User (Fire-and-forget)
      if (payment.user?.email) {
        this.notificationsService
          .notifyUser(
            payment.user.userId,
            `Payment Refunded: ${refundAmount} ETB has been refunded to your account.`,
          )
          .catch((err) =>
            this.logger.error(
              `Failed to notify user ${payment.user?.userId} of refund`,
              err instanceof Error ? err.stack : String(err),
            ),
          );
      }

      return {
        status: 'success',
        message: 'Payment refunded successfully',
        refundRef: refundData.refund_ref,
      };
    } catch (error) {
      this.logger.error(`Refund failed for ${dto.txRef}`, error);
      // If it's already a BadRequestException, rethrow it
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Refund failed at gateway');
    }
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

  async getUserTransactions(
    user: { userId: number; role: string },
    filters: TransactionHistoryDto,
  ) {
    const { page = 1, limit = 10, status, fromDate, toDate } = filters;
    const skip = (page - 1) * limit;

    let where: Prisma.PaymentWhereInput = {
      ...(status && { status }),
      ...(fromDate &&
        toDate && {
          createdAt: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
          },
        }),
    };

    if (user.role === 'ADMIN') {
      // Admin sees all transactions (no userId filter)
    } else if (user.role === 'GYMOWNER') {
      // Gym Owner sees transactions for their gym's classes/services
      where = {
        ...where,
        OR: [
          {
            classBooking: {
              class: {
                gym: {
                  gymOwnerId: user.userId,
                },
              },
            },
          },
          {
            serviceBooking: {
              service: {
                gym: {
                  gymOwnerId: user.userId,
                },
              },
            },
          },
        ],
      };
    } else if (user.role === 'CUSTOMER') {
      // Customer sees only their own transactions
      where = {
        ...where,
        userId: user.userId,
      };
    } else {
      // Trainers or others cannot view transactions
      throw new ForbiddenException(
        'You are not authorized to view transactions',
      );
    }

    const [data, total] = await Promise.all([
      this.databaseService.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { classBooking: true, serviceBooking: true },
      }),
      this.databaseService.payment.count({ where }),
    ]);

    return {
      data: data.map((payment) => this.mapPaymentToVerifyResponse(payment)),
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      },
    };
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
