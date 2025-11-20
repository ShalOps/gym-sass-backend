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

interface User {
  userId: number;
  role: string;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

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
    return this.paymentService.createPayment(user, dto);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // Allow more for webhooks
  @ApiOperation({ summary: 'Chapa webhook – do not protect with auth' })
  webhook(@Req() req: RawBodyRequest<Request>) {
    const signature = (req.headers['x-chapa-signature'] ||
      req.headers['chapa-signature']) as string;
    const payload = req.body as ChapaWebhookDto;
    const rawBody = req.rawBody;

    // Verify authenticity and handle event
    // We don't await this to return 200 OK immediately to Chapa
    this.paymentService
      .handleWebhook(payload, signature, rawBody)
      .catch((err) => {
        console.error('Webhook processing error:', err);
      });

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
}
