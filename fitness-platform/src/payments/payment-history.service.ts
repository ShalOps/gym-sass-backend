import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PaymentStatus, Prisma } from '@prisma/client';
import { TransactionHistoryDto } from './dto/transaction-history.dto';
import { VerifyPaymentResponseDto } from './dto/verify-payment.dto';
import { PaymentMapper } from './payment.mapper';

@Injectable()
export class PaymentHistoryService {
  constructor(private readonly databaseService: DatabaseService) {}

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

    return PaymentMapper.toVerifyResponse(payment);
  }

  buildTransactionFilter(
    user: { userId: number; role: string },
    filters: { status?: PaymentStatus; fromDate?: string; toDate?: string },
  ): Prisma.PaymentWhereInput {
    const { status, fromDate, toDate } = filters;

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

    return where;
  }

  async getUserTransactions(
    user: { userId: number; role: string },
    filters: TransactionHistoryDto,
  ) {
    const { page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where = this.buildTransactionFilter(user, filters);

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
      data: data.map((payment) => PaymentMapper.toVerifyResponse(payment)),
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      },
    };
  }
}
