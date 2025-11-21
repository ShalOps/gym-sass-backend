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
export class ClassBookingsService extends BookingsService {
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
      class?: {
        gymId: {
          in: number[];
        };
      };
      OR?: Array<{
        userId?: number;
        class?: {
          trainerId: number;
        };
      }>;
    } = {};

    // Role-based filtering
    if (currentUser.role === 'ADMIN') {
      // Admin can see all bookings
      where = {};
    } else if (currentUser.role === 'GYMOWNER') {
      // Gym owner can see bookings for classes in gyms they own
      const ownedGyms = await this.databaseService.gym.findMany({
        where: { gymOwnerId: userId },
        select: { gymId: true },
      });
      const gymIds = ownedGyms.map((g) => g.gymId);

      if (gymIds.length === 0) {
        // If they don't own any gyms, return empty result
        return [];
      }

      where.class = { gymId: { in: gymIds } };
    } else if (currentUser.role === 'TRAINER') {
      // Trainers can see their own bookings OR bookings for classes they teach
      where.OR = [
        { userId }, // Their own bookings
        { class: { trainerId: userId } }, // Bookings for classes they teach
      ];
    } else {
      // Regular users (CUSTOMER) can only see their own bookings
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
    const total = await this.databaseService.classBooking.count({
      where,
    });

    const bookings = await this.databaseService.classBooking.findMany({
      where,
      include: {
        class: {
          include: {
            gym: true,
            trainer: true,
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
    const booking = await this.databaseService.classBooking.findUnique({
      where: { classBookingId: id },
      include: {
        class: {
          include: {
            gym: true,
            trainer: true,
          },
        },
        user: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Class booking not found');
    }

    // Check if user owns the booking or has permission to view it
    if (booking.userId !== userId) {
      const currentUser = await this.databaseService.user.findUnique({
        where: { userId },
        select: { role: true },
      });

      if (!currentUser) {
        throw new ForbiddenException('User not found');
      }

      // Allow admin or gym owner to view any booking
      const isOwner = await this.checkOwnership(
        booking.class.gymId,
        userId,
        booking.class.trainerId,
      );
      if (!isOwner) {
        // For trainers, check if they teach this class
        if (
          currentUser.role === 'TRAINER' &&
          booking.class.trainerId === userId
        ) {
          // Trainer can view bookings for their classes
        } else {
          throw new ForbiddenException(
            'You do not have permission to view this booking',
          );
        }
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

    // Check capacity if status is being changed to CONFIRMED
    if (
      updateData.status === BookingStatus.CONFIRMED &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      const confirmedBookings = await this.databaseService.classBooking.count({
        where: {
          classId: booking.classId,
          status: BookingStatus.CONFIRMED,
        },
      });

      if (confirmedBookings >= booking.class.capacity) {
        throw new BadRequestException('Class is at full capacity');
      }
    }

    // Update the booking
    return this.databaseService.classBooking.update({
      where: { classBookingId: id },
      data: updateData,
      include: {
        class: {
          include: {
            gym: true,
            trainer: true,
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
    return this.databaseService.classBooking.update({
      where: { classBookingId: id },
      data: { status: BookingStatus.CANCELLED },
      include: {
        class: {
          include: {
            gym: true,
            trainer: true,
          },
        },
      },
    });
  }

  async markNoShow(id: number, currentUserId: number) {
    const booking = await this.databaseService.classBooking.findUnique({
      where: { classBookingId: id },
      include: {
        class: {
          include: {
            gym: true,
            trainer: true,
          },
        },
        user: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Class booking not found');
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
      // For non-admin, check if they own the gym or are the trainer for this class
      await this.checkOwnership(
        booking.class.gymId,
        currentUserId,
        // booking.class.trainerId,(might change in the future to allow trainers to mark no-shows for classes they teach)
      );
    }

    // Business logic: can only mark confirmed bookings as no-show
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Can only mark confirmed bookings as no-show',
      );
    }

    return this.databaseService.classBooking.update({
      where: { classBookingId: id },
      data: { status: BookingStatus.NO_SHOW },
      include: {
        class: {
          include: {
            gym: true,
            trainer: true,
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

    const amount = Number(booking.class.price);
    if (amount <= 0) {
      throw new BadRequestException('Booking is free, no payment needed');
    }

    return {
      amount,
      currency: 'ETB',
      email: booking.user?.email,
      firstName: booking.user?.firstName,
      lastName: booking.user?.lastName,
      description: `Payment for ${booking.class.className}`,
      metadata: {
        classBookingId: booking.classBookingId,
        gymId: booking.class.gymId,
      },
    };
  }

  async create(
    userId: number,
    classId: number,
    startTime?: Date,
    endTime?: Date,
    notes?: string,
    returnUrl?: string,
  ) {
    // Check if class exists and get capacity
    const gymClass = await this.databaseService.gymClasses.findUnique({
      where: { classId },
      include: { gym: true },
    });

    if (!gymClass) {
      throw new NotFoundException('Gym class not found');
    }

    if (startTime && endTime && startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Check if user already has an active booking for this class
    const existingBooking = await this.databaseService.classBooking.findFirst({
      where: {
        userId,
        classId,
        status: {
          not: BookingStatus.CANCELLED,
        },
      },
    });

    if (existingBooking) {
      throw new BadRequestException(
        'You already have an active booking for this class',
      );
    }

    // Check for time conflicts if startTime and endTime are provided
    if (startTime && endTime) {
      const conflictingBooking =
        await this.databaseService.classBooking.findFirst({
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
            class: true,
          },
        });

      if (conflictingBooking) {
        throw new BadRequestException(
          `Time conflict with existing booking for "${conflictingBooking.class.className}"`,
        );
      }
    }

    // Check capacity: count current confirmed bookings for this class at this time
    // For simplicity, assume no time overlap check yet, just total capacity
    const confirmedBookings = await this.databaseService.classBooking.count({
      where: {
        classId,
        status: BookingStatus.CONFIRMED,
      },
    });

    if (confirmedBookings >= gymClass.capacity) {
      throw new BadRequestException('Class is at full capacity');
    }

    // Validate returnUrl for paid classes BEFORE creating the booking
    if (Number(gymClass.price) > 0 && !returnUrl) {
      throw new BadRequestException(
        'returnUrl is required for paid class bookings',
      );
    }

    // Create the booking
    const booking = await this.databaseService.classBooking.create({
      data: {
        userId,
        classId,
        startTime,
        endTime,
        notes,
        status: BookingStatus.PENDING, // Default to PENDING until paid
      },
      include: {
        class: {
          include: {
            gym: true,
            trainer: true,
          },
        },
      },
    });

    // Initiate Payment if price > 0
    let paymentResponse;
    if (Number(gymClass.price) > 0) {
      // Get user role for payment service
      const user = await this.databaseService.user.findUnique({
        where: { userId },
        select: { role: true, email: true, firstName: true, lastName: true },
      });

      if (user) {
        try {
          paymentResponse = await this.paymentService.initializePayment(
            { userId, role: user.role },
            {
              amount: Number(gymClass.price),
              currency: 'ETB',
              email: user.email || '',
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              returnUrl: returnUrl!,
              metadata: {
                classBookingId: booking.classBookingId,
              },
              classBookingId: booking.classBookingId,
            },
          );
        } catch (error) {
          // If payment initialization fails, delete the booking to prevent "ghost" bookings
          await this.databaseService.classBooking.delete({
            where: { classBookingId: booking.classBookingId },
          });
          throw error;
        }
      }
    }

    return {
      booking,
      payment: paymentResponse as Record<string, unknown> | undefined,
    };
  }
}
