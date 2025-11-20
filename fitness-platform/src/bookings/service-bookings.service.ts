import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BookingsService } from './bookings.service';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PaymentService } from '../payments/payments.service';

@Injectable()
export class ServiceBookingsService extends BookingsService {
  constructor(
    protected readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
  ) {
    super(databaseService);
  }

  async findAll(
    userId: number,
    filters?: {
      status?: BookingStatus;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
  ) {
    // Get current user's role to determine what they can see
    const currentUser = await this.databaseService.user.findUnique({
      where: { userId },
      select: { role: true },
    });

    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    let where: {
      userId?: number;
      status?: BookingStatus;
      bookedAt?: {
        gte?: Date;
        lte?: Date;
      };
      service?: {
        gymId: {
          in: number[];
        };
      };
    } = {};

    // Role-based filtering
    if (currentUser.role === 'ADMIN') {
      // Admin can see all bookings
      where = {};
    } else if (currentUser.role === 'GYMOWNER') {
      // Gym owner can see bookings for services in gyms they own
      const ownedGyms = await this.databaseService.gym.findMany({
        where: { gymOwnerId: userId },
        select: { gymId: true },
      });
      const gymIds = ownedGyms.map((g) => g.gymId);

      if (gymIds.length === 0) {
        // If they don't own any gyms, return empty result
        return [];
      }

      where.service = { gymId: { in: gymIds } };
    } else {
      // Regular users (CUSTOMER, TRAINER) can only see their own bookings
      where.userId = userId;
    }

    // Apply additional filters
    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.bookedAt = {};
      if (filters.startDate) {
        where.bookedAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.bookedAt.lte = filters.endDate;
      }
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const total = await this.databaseService.serviceBooking.count({
      where,
    });

    const bookings = await this.databaseService.serviceBooking.findMany({
      where,
      include: {
        service: {
          include: {
            gym: true,
          },
        },
        user: currentUser.role !== 'CUSTOMER',
      },
      orderBy: { bookedAt: 'desc' },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: bookings,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: number, userId: number) {
    const booking = await this.databaseService.serviceBooking.findUnique({
      where: { serviceBookingId: id },
      include: {
        service: {
          include: {
            gym: true,
          },
        },
        user: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Service booking not found');
    }

    // Check if user owns the booking or is admin/gym owner
    if (booking.userId !== userId) {
      const isOwner = await this.checkOwnership(booking.service.gymId, userId);
      if (!isOwner) {
        throw new ForbiddenException(
          'You do not have permission to view this booking',
        );
      }
    }

    return booking;
  }

  async update(
    id: number,
    updateData: {
      status?: BookingStatus;
      notes?: string;
      paymentStatus?: PaymentStatus;
    },
    userId: number,
  ) {
    // First, find the booking to check ownership
    const booking = await this.findOne(id, userId);

    // Business logic: can't update status to certain values if already completed
    if (booking.status === BookingStatus.COMPLETED && updateData.status) {
      throw new BadRequestException(
        'Cannot update status of a completed booking',
      );
    }

    // Update the booking
    return this.databaseService.serviceBooking.update({
      where: { serviceBookingId: id },
      data: updateData,
      include: {
        service: {
          include: {
            gym: true,
          },
        },
      },
    });
  }

  async cancel(id: number, userId: number) {
    // First, find the booking to check ownership
    const booking = await this.findOne(id, userId);

    // Business logic: can't cancel if already completed or cancelled
    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot cancel a completed or already cancelled booking',
      );
    }

    // Update status to cancelled
    return this.databaseService.serviceBooking.update({
      where: { serviceBookingId: id },
      data: { status: BookingStatus.CANCELLED },
      include: {
        service: {
          include: {
            gym: true,
          },
        },
      },
    });
  }

  async markNoShow(id: number, currentUserId: number) {
    const booking = await this.databaseService.serviceBooking.findUnique({
      where: { serviceBookingId: id },
      include: {
        service: {
          include: {
            gym: true,
          },
        },
        user: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Service booking not found');
    }

    // Check if current user has permission (admin, gym owner, or trainer)
    const currentUser = await this.databaseService.user.findUnique({
      where: { userId: currentUserId },
      select: { role: true },
    });

    if (!currentUser) {
      throw new ForbiddenException('User not found');
    }

    // Allow admin to mark any booking as no-show
    if (currentUser.role !== 'ADMIN') {
      // For non-admin, check if they own the gym or are a trainer
      const isOwner = await this.checkOwnership(
        booking.service.gymId,
        currentUserId,
      );
      if (!isOwner) {
        throw new ForbiddenException(
          'You do not have permission to mark this booking as no-show',
        );
      }
    }

    // Business logic: can only mark confirmed bookings as no-show
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Can only mark confirmed bookings as no-show',
      );
    }

    return this.databaseService.serviceBooking.update({
      where: { serviceBookingId: id },
      data: { status: BookingStatus.NO_SHOW },
      include: {
        service: {
          include: {
            gym: true,
          },
        },
        user: true,
      },
    });
  }

  async getPaymentDetails(bookingId: number, userId: number) {
    const booking = await this.findOne(bookingId, userId);

    // Check if already paid
    if (booking.status === BookingStatus.CONFIRMED) {
      throw new BadRequestException('Booking is already paid or confirmed');
    }

    const amount = Number(booking.service.price);
    if (amount <= 0) {
      throw new BadRequestException('Booking is free, no payment needed');
    }

    return {
      amount,
      currency: 'ETB',
      email: booking.user?.email,
      firstName: booking.user?.firstName,
      lastName: booking.user?.lastName,
      description: `Payment for ${booking.service.name}`,
      metadata: {
        serviceBookingId: booking.serviceBookingId,
        gymId: booking.service.gymId,
      },
    };
  }

  // Additional method for creating a service booking
  async create(
    userId: number,
    serviceId: number,
    startTime?: Date,
    endTime?: Date,
    notes?: string,
    returnUrl?: string,
  ) {
    // Check if service exists
    const service = await this.databaseService.service.findUnique({
      where: { serviceId },
      include: { gym: true },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (startTime && endTime && startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Check for time conflicts if startTime and endTime are provided
    if (startTime && endTime) {
      const conflictingBooking =
        await this.databaseService.serviceBooking.findFirst({
          where: {
            userId,
            status: {
              not: BookingStatus.CANCELLED,
            },
            OR: [
              {
                AND: [
                  { startTime: { lte: startTime } },
                  { endTime: { gt: startTime } },
                ],
              },
              {
                AND: [
                  { startTime: { lt: endTime } },
                  { endTime: { gte: endTime } },
                ],
              },
              {
                AND: [
                  { startTime: { gte: startTime } },
                  { endTime: { lte: endTime } },
                ],
              },
            ],
          },
          include: {
            service: true,
          },
        });

      if (conflictingBooking) {
        throw new BadRequestException(
          `Time conflict with existing booking for "${conflictingBooking.service.name}"`,
        );
      }
    }

    const booking = await this.databaseService.serviceBooking.create({
      data: {
        userId,
        serviceId,
        startTime,
        endTime,
        notes,
        status: BookingStatus.PENDING, // Default to PENDING until paid
      },
      include: {
        service: {
          include: {
            gym: true,
          },
        },
      },
    });

    // Initiate Payment if price > 0
    let paymentResponse;
    if (Number(service.price) > 0) {
      if (!returnUrl) {
        throw new BadRequestException(
          'returnUrl is required for paid service bookings',
        );
      }

      // Get user role for payment service
      const user = await this.databaseService.user.findUnique({
        where: { userId },
        select: { role: true, email: true, firstName: true, lastName: true },
      });

      if (user) {
        paymentResponse = await this.paymentService.initializePayment(
          { userId, role: user.role },
          {
            amount: Number(service.price),
            currency: 'ETB',
            email: user.email || '',
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            returnUrl,
            metadata: {
              serviceBookingId: booking.serviceBookingId,
            },
            serviceBookingId: booking.serviceBookingId,
          },
        );
      }
    }

    return {
      booking,
      payment: paymentResponse as Record<string, unknown> | undefined,
    };
  }
}
