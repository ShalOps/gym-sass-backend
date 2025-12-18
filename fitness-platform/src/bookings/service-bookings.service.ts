import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
  InternalServerErrorException,
  ConflictException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BookingsService } from './bookings.service';
import { BookingStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PaymentService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Action } from './bookings.service';
import { NotificationType } from '@prisma/client';
import { TelegramService } from 'src/telegram/telegram.service';

@Injectable()
export class ServiceBookingsService extends BookingsService {
  private readonly logger = new Logger(ServiceBookingsService.name);

  constructor(
    protected readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
    private readonly notificationsService: NotificationsService,
    private readonly telegramService: TelegramService,
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
      }
    }

    // Update the booking
    return this.databaseService.$transaction(async (tx) => {
      const updateBooking = await tx.serviceBooking.update({
        where: { serviceBookingId: id },
        data: updateData,
        include: {
          service: {
            include: {
              gym: true,
            },
          },
          user: {
            select: {
              userName: true,
              userId: true,
              telegramChatId: true,
            },
          },
        },
      });

      if (updateData.status == BookingStatus.CONFIRMED) {
        await this.createBookingNotifications(
          updateBooking,
          NotificationType.SERVICE_BOOKING_CONFIRMED,
          Action.CONFIRMED,
          tx,
        );
      }

      if (updateData.status == BookingStatus.CANCELLED) {
        await this.createBookingNotifications(
          updateBooking,
          NotificationType.SERVICE_BOOKING_CANCELLED,
          Action.CANCELLED,
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
        serviceBookingId: id,
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
        const booking = await tx.serviceBooking.update({
          where: { serviceBookingId: id },
          data: { status: BookingStatus.CANCELLED },
          include: {
            service: {
              include: {
                gym: {
                  include: {
                    gymOwner: true,
                  },
                },
              },
            },
            user: true,
          },
        });

        await this.createBookingNotifications(
          booking,
          NotificationType.SERVICE_BOOKING_CANCELLED,
          Action.CANCELLED,
          tx,
        );
        return booking;
      },
    );

    // Notify Gym Owner
    if (cancelledBooking.service.gym.gymOwner?.email) {
      const ownerEmail = cancelledBooking.service.gym.gymOwner.email;
      const userName = `${cancelledBooking.user.firstName} ${cancelledBooking.user.lastName}`;
      const serviceName = cancelledBooking.service.name;
      const startTime = cancelledBooking.startTime
        ? cancelledBooking.startTime.toLocaleString()
        : 'N/A';

      this.notificationsService
        .notifyStaffServiceBookingCancellation(ownerEmail, {
          BookingName: serviceName,
          startTime: startTime,
          userName: userName,
          serviceName: serviceName,
          timezone: cancelledBooking.service.gym.timezone,
        })
        .catch((err) => {
          this.logger.error('Failed to notify owner of cancellation', err);
          throw new InternalServerErrorException(
            'Failed to notify owner of cancellation',
          );
        });
    }

    return cancelledBooking;
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
      await this.checkUserTimeConflict(userId, startTime, endTime);
    }

    // Validate returnUrl for paid services BEFORE creating the booking
    if (Number(service.price) > 0 && !returnUrl) {
      throw new BadRequestException(
        'returnUrl is required for paid service bookings',
      );
    }

    const transactionStartTime = Date.now();

    try {
      return await this.databaseService.$transaction(
        async (tx) => {
          const booking = await tx.serviceBooking.create({
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
                  amount: Number(service.price),
                  currency: 'ETB',
                  email: user.email,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  returnUrl: returnUrl!,
                  metadata: {
                    serviceBookingId: booking.serviceBookingId,
                  },
                  serviceBookingId: booking.serviceBookingId,
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
    const booking = await db.serviceBooking.findUnique({
      where: { serviceBookingId: bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Service Booking #${bookingId} not found`);
    }

    if (booking.userId !== userId) {
      throw new BadRequestException(
        `Service Booking #${bookingId} does not belong to User #${userId}`,
      );
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      throw new ConflictException(
        `Service Booking #${bookingId} is already confirmed/paid`,
      );
    }

    return booking;
  }

  async confirmBookingPayment(
    bookingId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || this.databaseService;
    const booking = await db.serviceBooking.update({
      where: { serviceBookingId: bookingId },
      data: { status: BookingStatus.CONFIRMED },
      include: {
        service: {
          include: {
            gym: true,
          },
        },
        user: true,
      },
    });

    await this.createBookingNotifications(
      booking,
      NotificationType.SERVICE_BOOKING_CONFIRMED,
      Action.CONFIRMED,
      db,
    );

    // Send confirmation email with localized time
    if (booking.user?.email && booking.startTime) {
      this.notificationsService
        .notifyUserServiceBookingConfirmation(booking.user.email, {
          BookingName: booking.service.name,
          serviceName: booking.service.name,
          duration: Number(booking.service.duration),
          userName: booking.user.firstName,
          startTime: booking.startTime,
          timezone: booking.service.gym.timezone,
        })
        .catch((err) => {
          this.logger.error(
            `Failed to send booking confirmation for ${bookingId}`,
            err,
          );
          throw new InternalServerErrorException(
            'Failed to send booking confirmation',
          );
        });
    }

    if (booking.service?.gym.gymOwnerId && booking.startTime) {
      const owner = await this.databaseService.user.findUnique({
        where: { userId: booking.service.gym.gymOwnerId },
      });

      if (owner?.email) {
        this.notificationsService
          .notifyStaffServiceBookingConfirmation(owner.email, {
            BookingName: booking.service.name,
            serviceName: booking.service.name,
            duration: Number(booking.service.duration),
            userName: booking.user.firstName,
            startTime: booking.startTime,
            timezone: booking.service.gym.timezone,
          })
          .catch((err) => {
            this.logger.error(
              `Failed to send booking confirmation for ${bookingId}`,
              err,
            );
          });
      }
    }

    return booking;
  }

  async processRefundCancellation(
    bookingId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || this.databaseService;
    const booking = await db.serviceBooking.findUnique({
      where: { serviceBookingId: bookingId },
    });

    if (!booking) {
      this.logger.warn(
        `Attempted to cancel non-existent service booking #${bookingId} after refund`,
      );
      return;
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return; // Already cancelled
    }

    await db.serviceBooking.update({
      where: { serviceBookingId: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        notes: booking.notes
          ? `${booking.notes}\n[System] Cancelled due to payment refund`
          : '[System] Cancelled due to payment refund',
      },
    });

    this.logger.log(
      `Cancelled service booking #${bookingId} due to payment refund`,
    );
  }

  private async checkUserTimeConflict(
    userId: number,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: number,
  ) {
    const conflictingBooking =
      await this.databaseService.serviceBooking.findFirst({
        where: {
          userId,
          ...(excludeBookingId
            ? { serviceBookingId: { not: excludeBookingId } }
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
          service: true,
        },
      });

    if (conflictingBooking) {
      throw new BadRequestException(
        `Time conflict with existing booking for "${conflictingBooking.service.name}"`,
      );
    }
  }

  async createBookingNotifications(
    booking: {
      user: {
        userName: string;
        userId: number;
        telegramChatId?: bigint | null;
      };
      service: {
        name: string;
        gym: { gymOwnerId: number };
      };
    },
    notificationType: NotificationType,
    action: Action,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.databaseService;

    try {
      await Promise.all([
        client.notification.create({
          data: {
            userId: booking.service.gym.gymOwnerId,
            type: notificationType,
            message: `User with username ${booking.user.userName} ${action} your service ${booking.service.name}`,
          },
        }),
      ]);
    } catch (error) {
      console.error('Transaction failed, rolling back notifications:', error);
      throw error;
    }

    if (booking.user.telegramChatId) {
      const textToSend = `Your booking for service "${booking.service.name}" has been ${action}.`;

      await this.telegramService
        .sendMessage(
          booking.user.telegramChatId,
          `🔔 ${textToSend}`,
          booking.user.userId,
        )
        .catch((err) => {
          console.error('Telegram send failed:', err);
        });
    } else {
      this.logger.debug(
        `User ${booking.user.userId} does not have a Telegram chat ID. Skipping Telegram notification.`,
      );
    }
  }
}
