import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  UnprocessableEntityException,
  Query,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { PaymentService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InitializePaymentResponseDto } from './dto/initialize-payment.dto';
import { VerifyPaymentResponseDto } from './dto/verify-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request } from 'express';
import { ChapaWebhookDto } from './dto/webhook.dto';
import { Throttle } from '@nestjs/throttler';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { RecordManualPaymentDto } from './dto/manual-payment.dto';
import { TransactionHistoryDto } from './dto/transaction-history.dto';
import { ClassBookingsService } from '../bookings/class-bookings.service';
import { ServiceBookingsService } from '../bookings/service-bookings.service';
import { PaymentType } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';

interface User {
  userId: number;
  role: string;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly classBookingsService: ClassBookingsService,
    private readonly serviceBookingsService: ServiceBookingsService,
  ) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Stricter limit for payments
  @ApiOperation({ summary: 'Initialize Chapa payment for class or membership' })
  @ApiCreatedResponse({ type: InitializePaymentResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid booking or payment details',
  })
  @ApiResponse({ status: 403, description: 'Booking does not belong to user' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async createPayment(
    @Req() req: Request,
    @Body() dto: CreatePaymentDto,
  ): Promise<InitializePaymentResponseDto> {
    const user = req.user as User;

    type PaymentDetails = {
      amount: number;
      currency: string;
      email: string;
      firstName: string;
      lastName: string;
      metadata?: Record<string, any>;
      classBookingId?: number;
      serviceBookingId?: number;
      type?: PaymentType;
    };

    let paymentDetails: PaymentDetails | undefined;

    if (dto.type === PaymentType.BOOKING) {
      if (dto.classBookingId) {
        paymentDetails = (await this.classBookingsService.getPaymentDetails(
          dto.classBookingId,
          user.userId,
        )) as PaymentDetails;
      } else if (dto.serviceBookingId) {
        paymentDetails = (await this.serviceBookingsService.getPaymentDetails(
          dto.serviceBookingId,
          user.userId,
        )) as PaymentDetails;
      } else {
        throw new BadRequestException('Booking ID required');
      }
    } else {
      throw new UnprocessableEntityException(
        `Payment type ${dto.type} not supported`,
      );
    }

    if (!paymentDetails) {
      throw new BadRequestException('Payment details could not be determined');
    }

    return this.paymentService.initializePayment(user, {
      ...paymentDetails,
      returnUrl: dto.returnUrl,
      metadata: {
        ...(dto.metadata ?? {}),
        ...(paymentDetails.metadata ?? {}),
      },
      type: dto.type,
      classBookingId: dto.classBookingId,
      serviceBookingId: dto.serviceBookingId,
    });
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // Allow more for webhooks
  @ApiOperation({ summary: 'Chapa webhook – do not protect with auth' })
  async webhook(@Req() req: RawBodyRequest<Request>) {
    const signature = (req.headers['x-chapa-signature'] ||
      req.headers['chapa-signature']) as string;
    const payload = req.body as ChapaWebhookDto;
    const rawBody = req.rawBody;

    // Await the processing. If it fails, request throws 500, and Chapa will retry.
    await this.paymentService.handleWebhook(payload, signature, rawBody);

    return { status: 'success' };
  }

  @Get('verify/:txRef')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Manually verify payment status (used by frontend)',
  })
  @ApiOkResponse({ type: VerifyPaymentResponseDto })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User cannot verify this payment',
  })
  async verify(
    @Param('txRef') txRef: string,
    @Req() req: Request,
  ): Promise<VerifyPaymentResponseDto> {
    const user = req.user as User;
    return this.paymentService.verifyPayment(txRef, user);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify payment status (POST alternative)' })
  @ApiOkResponse({ type: VerifyPaymentResponseDto })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async verifyPost(
    @Body('tx_ref') txRef: string,
    @Req() req: Request,
  ): Promise<VerifyPaymentResponseDto> {
    const user = req.user as User;
    return this.paymentService.verifyPayment(txRef, user);
  }

  @Get('transactions/:txRef')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get transaction details by transaction reference' })
  @ApiOkResponse({ description: 'Transaction details retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Transaction not found.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User cannot view this transaction',
  })
  async getTransaction(@Param('txRef') txRef: string, @Req() req: Request) {
    const user = req.user as User;
    return await this.paymentService.getTransactionByTxRef(txRef, user);
  }

  @Post('refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Refund a payment (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment refunded successfully' })
  async refund(@Body() dto: RefundPaymentDto, @Req() req: Request) {
    const user = req.user as User;
    return this.paymentService.refundPayment(user, dto);
  }

  @Post('record-manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GYMOWNER')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Record a manual cash payment (Staff only)' })
  @ApiResponse({ status: 201, description: 'Manual payment recorded' })
  async recordManual(@Body() dto: RecordManualPaymentDto, @Req() req: Request) {
    const user = req.user as User;
    return this.paymentService.recordManualPayment(user, dto);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user transaction history' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated transaction history',
  })
  async getUserHistory(
    @Req() req: Request,
    @Query() query: TransactionHistoryDto,
  ) {
    const user = req.user as User;
    return await this.paymentService.getUserTransactions(user, query);
  }
}
