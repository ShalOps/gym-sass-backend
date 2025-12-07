import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  forwardRef,
  Logger,
  ConflictException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BookingsService } from './bookings.service';
import { BookingStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PaymentService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';
import { Action } from './bookings.service';

@Injectable()
export class ClassBookingsService extends BookingsService {
  private readonly logger = new Logger(ClassBookingsService.name);

  constructor(
    protected readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
    private readonly notificationsService: NotificationsService,
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
      startTime?: Date;
      endTime?: Date;
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

    // Handle Rescheduling (Time Change)
    if (updateData.startTime || updateData.endTime) {
      // 1. Validate Time Logic
      const newStartTime = updateData.startTime || booking.startTime;
      const newEndTime = updateData.endTime || booking.endTime;

      if (newStartTime && newEndTime && newStartTime >= newEndTime) {
        throw new BadRequestException('Start time must be before end time');
      }

      // 2. Check for Conflicts
      if (newStartTime && newEndTime) {
        await this.checkUserTimeConflict(userId, newStartTime, newEndTime, id);
        await this.checkTrainerAvailability(
          booking.class.trainerId,
          newStartTime,
          newEndTime,
          booking.classId,
        );
      }
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
    return this.databaseService.$transaction(async (tx) => {
      const updateBooking = await tx.classBooking.update({
        where: { classBookingId: id },
        data: updateData,
        include: {
          class: {
            include: {
              gym: true,
              trainer: true,
            },
          },
          user: {
            select: {
              userName: true,
            },
          },
        },
      });

      if (updateData.status == BookingStatus.CONFIRMED) {
        await this.createBookingNotifications(
          updateBooking,
          NotificationType.CLASS_BOOKING_CONFIRMED,
          Action.CONFIRMED,
          tx,
        );
      }

      return updateBooking;
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

    // Check for successful payments
    const successfulPayment = await this.databaseService.payment.findFirst({
      where: {
        classBookingId: id,
        status: PaymentStatus.PROCESSED,
      },
    });

    if (successfulPayment) {
      throw new BadRequestException(
        'This booking is paid. Please request a refund to cancel.',
      );
    }

    // Update status to cancelled
    const cancelledBooking = await this.databaseService.$transaction(
      async (tx) => {
        const booking = await tx.classBooking.update({
          where: { classBookingId: id },
          data: { status: BookingStatus.CANCELLED },
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

        await this.createBookingNotifications(
          booking,
          NotificationType.CLASS_BOOKING_CANCELLED,
          Action.CANCELLED,
          tx,
        );
        return booking;
      },
    );

    // Notify Trainer
    if (cancelledBooking.class.trainer?.email) {
      const trainerEmail = cancelledBooking.class.trainer.email;
      const userName = `${cancelledBooking.user.firstName} ${cancelledBooking.user.lastName}`;
      const className = cancelledBooking.class.className;
      const startTime = cancelledBooking.startTime
        ? cancelledBooking.startTime.toLocaleString()
        : 'N/A';

      this.notificationsService
        .notifyStaff(
          trainerEmail,
          `Booking cancelled by ${userName} for ${className} at ${startTime}`,
        )
        .catch((err) =>
          this.logger.error('Failed to notify trainer of cancellation', err),
        );
    }

    return cancelledBooking;
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
      await this.checkUserTimeConflict(userId, startTime, endTime);

      // Verify Trainer Availability
      await this.checkTrainerAvailability(
        gymClass.trainerId,
        startTime,
        endTime,
        classId,
      );
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

    const transactionStartTime = Date.now();

    try {
      return await this.databaseService.$transaction(
        async (tx) => {
          // Create the booking
          const booking = await tx.classBooking.create({
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
              select: {
                role: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            });

            if (user) {
              // If payment initialization fails, the error propagates and triggers transaction rollback
              paymentResponse = await this.paymentService.initializePayment(
                { userId, role: user.role },
                {
                  amount: Number(gymClass.price),
                  currency: 'ETB',
                  email: user.email,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  returnUrl: returnUrl!,
                  metadata: {
                    classBookingId: booking.classBookingId,
                  },
                  classBookingId: booking.classBookingId,
                },
                tx,
              );
            }
          }

          return {
            booking,
            payment: paymentResponse as Record<string, unknown> | undefined,
          };
        },
        { timeout: 20000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          this.logger.warn(
            'Booking failed: Duplicate booking or payment reference',
          );
          throw new BadRequestException(
            'Duplicate booking or payment reference.',
          );
        }
      }

      // Handle transaction timeout specifically
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
        this.logger.warn(`Booking failed: ${error.message}`);
        throw error;
      }

      this.logger.error(
        'Booking transaction failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Booking transaction failed');
    }
  }

  async validateBookingForPayment(
    bookingId: number,
    userId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || this.databaseService;
    const booking = await db.classBooking.findUnique({
      where: { classBookingId: bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Class Booking #${bookingId} not found`);
    }

    if (booking.userId !== userId) {
      throw new BadRequestException(
        `Class Booking #${bookingId} does not belong to User #${userId}`,
      );
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      throw new ConflictException(
        `Class Booking #${bookingId} is already confirmed/paid`,
      );
    }

    return booking;
  }

  async confirmBookingPayment(
    bookingId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || this.databaseService;
    const booking = await db.classBooking.update({
      where: { classBookingId: bookingId },
      data: { status: BookingStatus.CONFIRMED },
      include: {
        class: {
          include: {
            gym: true,
          },
        },
        user: true,
      },
    });

    // Send confirmation email with localized time
    if (booking.user?.email && booking.startTime) {
      // We don't await this to avoid blocking the transaction/response
      this.notificationsService
        .sendBookingConfirmation(booking.user.email, {
          BookingName: booking.class.className,
          startTime: booking.startTime,
          userName: booking.user.userName,
          gymName: booking.class.gym.gymName,
          timezone: booking.class.gym.timezone,
        })
        .catch((err) =>
          this.logger.error(
            `Failed to send booking confirmation for ${bookingId}`,
            err,
          ),
        );
    }

    await this.createBookingNotifications(
      booking,
      NotificationType.CLASS_BOOKING_CONFIRMED,
      Action.CONFIRMED,
      db,
    );

    return booking;
  }

  async processRefundCancellation(
    bookingId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || this.databaseService;
    const booking = await db.classBooking.findUnique({
      where: { classBookingId: bookingId },
    });

    if (!booking) {
      this.logger.warn(
        `Attempted to cancel non-existent class booking #${bookingId} after refund`,
      );
      return;
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return; // Already cancelled
    }

    await db.classBooking.update({
      where: { classBookingId: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        notes: booking.notes
          ? `${booking.notes}\n[System] Cancelled due to payment refund`
          : '[System] Cancelled due to payment refund',
      },
    });

    this.logger.log(
      `Cancelled class booking #${bookingId} due to payment refund`,
    );
  }

  private async checkUserTimeConflict(
    userId: number,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: number,
  ) {
    const conflictingBooking =
      await this.databaseService.classBooking.findFirst({
        where: {
          userId,
          ...(excludeBookingId
            ? { classBookingId: { not: excludeBookingId } }
            : {}),
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

  private async checkTrainerAvailability(
    trainerId: number,
    startTime: Date,
    endTime: Date,
    excludeClassId?: number,
  ) {
    const trainerConflict = await this.databaseService.classBooking.findFirst({
      where: {
        status: {
          not: BookingStatus.CANCELLED,
        },
        class: {
          trainerId: trainerId,
        },
        ...(excludeClassId ? { classId: { not: excludeClassId } } : {}),
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

    if (trainerConflict) {
      throw new ConflictException(
        `Trainer is unavailable. They are teaching "${trainerConflict.class.className}" during this time slot.`,
      );
    }
  }

  async createBookingNotifications(
    booking: {
      user: { userName: string };
      class: {
        className: string;
        gym: { gymOwnerId: number };
        trainerId: number;
      };
    },
    notificationType: NotificationType,
    action: Action,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.databaseService;

    await Promise.all([
      client.notification.create({
        data: {
          userId: booking.class.gym.gymOwnerId,
          type: notificationType,
          message: `User with username ${booking.user.userName} ${action} your class ${booking.class.className}`,
        },
      }),

      booking.class.trainerId !== booking.class.gym.gymOwnerId
        ? client.notification.create({
            data: {
              userId: booking.class.trainerId,
              type: notificationType,
              message: `User with username ${booking.user.userName} ${action} your class ${booking.class.className}`,
            },
          })
        : Promise.resolve(),
    ]);
  }
}
