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
  Res,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentService } from './payments.service';
import { PaymentExportService } from './payment-export.service';
import { PaymentHistoryService } from './payment-history.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InitializePaymentResponseDto } from './dto/initialize-payment.dto';
import { VerifyPaymentResponseDto } from './dto/verify-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request, Response } from 'express';
import { ChapaWebhookDto } from './dto/webhook.dto';
import { Throttle } from '@nestjs/throttler';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { RecordManualPaymentDto } from './dto/manual-payment.dto';
import { TransactionHistoryDto } from './dto/transaction-history.dto';
import { ClassBookingsService } from '../bookings/class-bookings.service';
import { ServiceBookingsService } from '../bookings/service-bookings.service';
import { PaymentType, PaymentStatus } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PaymentMarketPlaceService } from './payments-marketplace.service';

interface User {
  userId: number;
  role: string;
  email: string;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentExportService: PaymentExportService,
    private readonly paymentHistoryService: PaymentHistoryService,
    private readonly classBookingsService: ClassBookingsService,
    private readonly serviceBookingsService: ServiceBookingsService,
    private readonly paymentMarketPlaceService: PaymentMarketPlaceService,
  ) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Stricter limit for payments
  @ApiOperation({ summary: 'Initialize Chapa payment for class or membership' })
  @ApiCreatedResponse({ type: InitializePaymentResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid booking or payment details',
  })
  @ApiResponse({ status: 403, description: 'Booking does not belong to user' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 422, description: 'Payment type not supported' })
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
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
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
  @ApiBearerAuth('JWT-auth')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Manually verify payment status (used by frontend)',
  })
  @ApiParam({
    name: 'txRef',
    description: 'Transaction reference',
    type: 'string',
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
  @ApiBearerAuth('JWT-auth')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify payment status (POST alternative)' })
  @ApiOkResponse({ type: VerifyPaymentResponseDto })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User cannot verify this payment',
  })
  async verifyPost(
    @Body('tx_ref') txRef: string,
    @Req() req: Request,
  ): Promise<VerifyPaymentResponseDto> {
    const user = req.user as User;
    return this.paymentService.verifyPayment(txRef, user);
  }
  @Get('verify/order/:txRef')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Manually verify payment status for order (used by frontend)',
  })
  @ApiParam({
    name: 'txRef',
    description: 'Transaction reference',
    type: 'string',
  })
  @ApiOkResponse({ type: VerifyPaymentResponseDto })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User cannot verify this payment',
  })
  async verifyOrder(
    @Param('txRef') txRef: string,
    @Req() req: Request,
  ): Promise<VerifyPaymentResponseDto> {
    const user = req.user as User;
    return this.paymentMarketPlaceService.verifyPayment(txRef, user);
  }

  @Get('transactions/:txRef')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get transaction details by transaction reference' })
  @ApiParam({
    name: 'txRef',
    description: 'Transaction reference',
    type: 'string',
  })
  @ApiOkResponse({ description: 'Transaction details retrieved successfully.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User cannot view this transaction',
  })
  @ApiResponse({ status: 404, description: 'Transaction not found.' })
  async getTransaction(@Param('txRef') txRef: string, @Req() req: Request) {
    const user = req.user as User;
    return await this.paymentHistoryService.getTransactionByTxRef(txRef, user);
  }

  @Post('refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Refund a payment (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment refunded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid refund request' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async refund(@Body() dto: RefundPaymentDto, @Req() req: Request) {
    const user = req.user as User;
    return this.paymentService.refundPayment(user, dto);
  }

  @Post('record-manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'GYMOWNER')
  @ApiBearerAuth('JWT-auth')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Record a manual cash payment (Staff only)' })
  @ApiResponse({ status: 201, description: 'Manual payment recorded' })
  @ApiResponse({ status: 400, description: 'Invalid payment details' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async recordManual(@Body() dto: RecordManualPaymentDto, @Req() req: Request) {
    const user = req.user as User;
    return this.paymentService.recordManualPayment(user, dto);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user transaction history' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: PaymentStatus,
    description: 'Filter by payment status',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Filter by start date (ISO string)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Filter by end date (ISO string)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Field to sort by (default: createdAt)',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order (default: desc)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated transaction history',
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  async getUserHistory(
    @Req() req: Request,
    @Query() query: TransactionHistoryDto,
  ) {
    const user = req.user as User;
    return await this.paymentHistoryService.getUserTransactions(user, query);
  }

  @Get('export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Export user transaction history' })
  @ApiQuery({
    name: 'format',
    enum: ['csv', 'pdf'],
    required: true,
    description: 'Export format',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: PaymentStatus,
    description: 'Filter by payment status',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Filter by start date (ISO string)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Filter by end date (ISO string)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the exported file',
    content: {
      'text/csv': { schema: { type: 'string', format: 'binary' } },
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
    },
  })
  async exportHistory(
    @Req() req: Request,
    @Query('format') format: 'csv' | 'pdf',
    @Query('status') status?: PaymentStatus,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Res() res?: Response,
  ) {
    const user = req.user as User;
    if (!res) {
      throw new BadRequestException('Response object is missing');
    }
    return this.paymentExportService.exportHistory(
      user,
      format,
      { status, fromDate, toDate },
      res,
    );
  }
}
