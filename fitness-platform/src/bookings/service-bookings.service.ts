import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BookingsService } from './bookings.service';
import { BookingStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class ServiceBookingsService extends BookingsService {
  constructor(protected readonly databaseService: DatabaseService) {
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
    // Auto-complete past bookings before returning results
    await this.autoCompletePastBookings();

    const where: {
      userId: number;
      status?: BookingStatus;
      bookedAt?: {
        gte?: Date;
        lte?: Date;
      };
    } = { userId };

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

    return this.databaseService.serviceBooking.findMany({
      where,
      include: {
        service: {
          include: {
            gym: true,
          },
        },
      },
      orderBy: { bookedAt: 'desc' },
      skip,
      take: limit,
    });
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

  // Additional method for creating a service booking
  async create(
    userId: number,
    serviceId: number,
    startTime?: Date,
    endTime?: Date,
    notes?: string,
  ) {
    // Check if service exists
    const service = await this.databaseService.service.findUnique({
      where: { serviceId },
      include: { gym: true },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
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

    return this.databaseService.serviceBooking.create({
      data: {
        userId,
        serviceId,
        startTime,
        endTime,
        notes,
      },
      include: {
        service: {
          include: {
            gym: true,
          },
        },
      },
    });
  }
}
