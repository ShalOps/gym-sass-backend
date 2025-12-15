import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { PaginationDto } from './dto/pagination.dto';
import { CreateGymsDto } from './dto/create-gyms.dto';
import { UpdateGymsDto } from './dto/update-gyms.dto';
import { DateRangeDto } from './dto/date-range.dto';
import { DateUtil } from '../common/utils/date.util';
import { NotificationType } from '@prisma/client';
import { Role } from '@prisma/client';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class GymsService {
  private readonly logger = new Logger(GymsService.name);
  constructor(
    private readonly databaseservice: DatabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

async create(createGymsDto: CreateGymsDto, currentUserId: number) {
  const gymOwner = await this.databaseservice.user.findUnique({
    where: { userId: currentUserId },
    select: { userId: true, role: true },
  });

  if (!gymOwner) {
    throw new NotFoundException(`User with ID ${currentUserId} not found`);
  }

  if (gymOwner.role !== 'GYMOWNER') {
    throw new ForbiddenException(
      `User with ID ${currentUserId} is not a Gym owner`,
    );
  }

  if (
    createGymsDto.timezone &&
    !DateUtil.isValidTimezone(createGymsDto.timezone)
  ) {
    throw new BadRequestException(
      `Invalid timezone: ${createGymsDto.timezone}`,
    );
  }

  return await this.databaseservice.$transaction(async (tx) => {
    // Create gym
    const newGym = await tx.gym.create({
      data: { ...createGymsDto, gymOwnerId: currentUserId },
    });

    // Notify ALL admins (in-app)
    const adminIdList = await tx.user.findMany({
      where: { role: Role.ADMIN },
      select: { userId: true },
    });

    for (const admin of adminIdList) {
      await tx.notification.create({
        data: {
          userId: admin.userId,
          type: NotificationType.NEW_GYM_CREATED,
          message: `Gym "${newGym.gymName}" was created. Please verify the gym.`,
        },
      });
    }

    // Fetch one admin (e.g. the main admin)
    const admin = await tx.user.findFirst({
      where: { role: Role.ADMIN },
      select: { email: true },
    });

    if (admin?.email) {
      // Fire-and-forget email
      const owner = await tx.user.findUnique({
        where: { userId: currentUserId },
        select: { userName: true, email: true },
      });
      if(owner){
      this.notificationsService
        .notifyAdmin(admin.email, {
          gymName: newGym.gymName,
          ownerName: owner.userName,
          gymId: newGym.gymId,
          ownerEmail: owner.email
        })
        .catch((error) => {
          this.logger.error(
            'Error sending new gym creation email to admin:',
            error,
          );
        });
      }
    }

    return newGym;
  });
}

  async findAll(pagination: PaginationDto) {
    const {
      page,
      limit,
      search,
      location,
      workingHours,
      verified,
      gymOwnerId,
    } = pagination;
    const skip = (page - 1) * limit;
    const where: Prisma.GymWhereInput = {};
    if (search)
      where.gymName = {
        contains: search,
        mode: 'insensitive' as const,
      };
    if (location)
      where.location = {
        contains: location,
        mode: 'insensitive' as const,
      };
    if (workingHours) {
      where.workingHours = {
        contains: workingHours,
        mode: 'insensitive' as const,
      };
    }
    if (verified !== undefined) where.verified = verified;
    if (gymOwnerId) where.gymOwnerId = gymOwnerId; // For admin or owner use
    const [data, total] = await Promise.all([
      this.databaseservice.gym.findMany({
        where,
        skip,
        take: limit,
        include: {
          coverPhoto: {
            select: {
              thumbnailUrl: true,
            },
          },
        },
      }),
      this.databaseservice.gym.count({ where }),
    ]);

    const transformedData = data.map((gym) => ({
      ...gym,
      coverPhotoUrl: gym.coverPhoto?.thumbnailUrl || null,
    }));

    return {
      data: transformedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const gym = await this.databaseservice.gym.findUnique({
      where: {
        gymId: id,
      },
      include: {
        coverPhoto: {
          select: {
            thumbnailUrl: true,
          },
        },
      },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${id} not found`);
    }

    return {
      ...gym,
      coverPhotoUrl: gym.coverPhoto?.thumbnailUrl || null,
    };
  }

  async update(
    id: number,
    updateGymsDto: UpdateGymsDto,
    currentUserId: number,
  ) {
    const gym = await this.databaseservice.gym.findUnique({
      where: {
        gymId: id,
      },
      select: {
        gymId: true,
        gymOwnerId: true,
      },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${id} not found`);
    }

    const ownerOrAdmin = await this.databaseservice.user.findUnique({
      where: {
        userId: currentUserId,
      },
      select: {
        userId: true,
        role: true,
      },
    });

    if (!ownerOrAdmin) {
      throw new NotFoundException(`User with ID ${currentUserId} not found`);
    }

    if (ownerOrAdmin.role !== 'ADMIN') {
      if (gym?.gymOwnerId !== currentUserId) {
        throw new ForbiddenException('Cannot update gym you do not own');
      }

      if (ownerOrAdmin.role !== 'GYMOWNER') {
        throw new ForbiddenException(
          `User with ID ${currentUserId} is not a Gym owner`,
        );
      }
    }

    if (
      updateGymsDto.timezone &&
      !DateUtil.isValidTimezone(updateGymsDto.timezone)
    ) {
      throw new BadRequestException(
        `Invalid timezone: ${updateGymsDto.timezone}`,
      );
    }

    return this.databaseservice.gym.update({
      where: {
        gymId: id,
      },
      data: updateGymsDto,
    });
  }

  async remove(id: number, currentUserId: number) {
    const gym = await this.databaseservice.gym.findUnique({
      where: {
        gymId: id,
      },
      select: {
        gymId: true,
        gymOwnerId: true,
      },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${id} not found`);
    }

    const adminRole = await this.databaseservice.user.findUnique({
      where: {
        userId: currentUserId,
      },
      select: {
        userId: true,
        role: true,
      },
    });

    if (adminRole?.role !== 'ADMIN') {
      if (gym?.gymOwnerId !== currentUserId) {
        throw new ForbiddenException('Cannot delete gym you do not own');
      }
    }

    await this.databaseservice.gym.delete({
      where: {
        gymId: id,
      },
    });
  }

  async getTotalBookings(
    query: DateRangeDto,
    actingUserId: number,
    isAdmin: boolean,
  ) {
    const { gymId, startDate, endDate } = query;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const ownerFilter = isAdmin
      ? Prisma.sql``
      : Prisma.sql`AND g."gymOwnerId" = ${actingUserId}`;

    try {
      const result = await this.databaseservice.$queryRaw<{ total: number }[]>`
      WITH "AllBookings" AS (
        SELECT cb."bookedAt", gc."gymId"
        FROM "ClassBooking" cb
        INNER JOIN "GymClasses" gc ON gc."classId" = cb."classId"

        UNION ALL

        SELECT sb."bookedAt", s."gymId"
        FROM "ServiceBooking" sb
        INNER JOIN "Service" s ON s."serviceId" = sb."serviceId"
      )

        SELECT
          COUNT(*)::int AS total
        FROM "AllBookings" b

        INNER JOIN "Gym" g
            ON g."gymId" = b."gymId" ${ownerFilter}

        WHERE (${gymId}::int IS NULL OR b."gymId" = ${gymId})
          AND (${start}::timestamp IS NULL OR b."bookedAt" >= ${start})
          AND (${end}::timestamp IS NULL OR b."bookedAt" <= ${end});
    `;

      return result && result.length > 0 ? result[0] : { total: 0 };
    } catch (error) {
      console.log('Error fetching total bookings:', error);
      throw new Error('Could not fetch total bookings');
    }
  }

  async getMonthlyBookings(
    query: DateRangeDto,
    actingUserId: number,
    isAdmin: boolean,
  ) {
    const { gymId, startDate, endDate } = query;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const ownerFilter = isAdmin
      ? Prisma.sql``
      : Prisma.sql`AND g."gymOwnerId" = ${actingUserId}`;

    try {
      const result = await this.databaseservice.$queryRaw`
      SELECT TO_CHAR(b."bookedAt", 'YYYY-MM') AS period,
             COUNT(*)::int AS total
      FROM (
        SELECT cb."bookedAt", gc."gymId"
        FROM "ClassBooking" cb
        JOIN "GymClasses" gc ON gc."classId" = cb."classId"

        UNION ALL

        SELECT sb."bookedAt", s."gymId"
        FROM "ServiceBooking" sb
        JOIN "Service" s ON s."serviceId" = sb."serviceId"
      ) b
      INNER JOIN "Gym" g ON g."gymId" = b."gymId" ${ownerFilter}

      WHERE (${gymId}::int IS NULL OR b."gymId" = ${gymId})
      AND (${start}::timestamp IS NULL OR b."bookedAt" >= ${start})
      AND (${end}::timestamp IS NULL OR b."bookedAt" <= ${end})
      GROUP BY period
      ORDER BY period ASC;
    `;
      return result;
    } catch (error) {
      console.log('Error fetching monthly bookings:', error);
      throw new Error('Could not fetch monthly bookings');
    }
  }

  async getWeeklyBookings(
    query: DateRangeDto,
    actingUserId: number,
    isAdmin: boolean,
  ) {
    const { gymId, startDate, endDate } = query;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const ownerFilter = isAdmin
      ? Prisma.sql``
      : Prisma.sql`AND g."gymOwnerId" = ${actingUserId}`;

    try {
      const result = await this.databaseservice.$queryRaw`
        SELECT TO_CHAR(DATE_TRUNC('week', b."bookedAt"), 'YYYY-MM-DD') AS weekStart,
              COUNT(*)::int AS total
        FROM (
          SELECT cb."bookedAt", gc."gymId"
          FROM "ClassBooking" cb
          JOIN "GymClasses" gc ON gc."classId" = cb."classId"

          UNION ALL

          SELECT sb."bookedAt", s."gymId"
          FROM "ServiceBooking" sb
          JOIN "Service" s ON s."serviceId" = sb."serviceId"
        ) b
        INNER JOIN "Gym" g ON g."gymId" = b."gymId" ${ownerFilter}

        WHERE (${gymId}::int IS NULL OR b."gymId" = ${gymId})
        AND (${start}::timestamp IS NULL OR b."bookedAt" >= ${start})
        AND (${end}::timestamp IS NULL OR b."bookedAt" <= ${end})
        GROUP BY weekStart
        ORDER BY weekStart ASC;
    `;
      return result;
    } catch (error) {
      console.log('Error fetching weekly bookings:', error);
      throw new Error('Could not fetch weekly bookings');
    }
  }

  async getRevenueStats(
    query: DateRangeDto,
    actingUserId: number,
    isAdmin: boolean,
  ) {
    const { gymId, startDate, endDate } = query;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const ownerFilter = isAdmin
      ? Prisma.sql``
      : Prisma.sql`AND g."gymOwnerId" = ${actingUserId}`;
    try {
      const result = await this.databaseservice.$queryRaw<
        { totalRevenue: number }[]
      >`
        SELECT
          COALESCE(SUM(b.price), 0)::float AS totalRevenue
        FROM (
          SELECT gc.price, cb."bookedAt", gc."gymId", cb."paymentStatus"
          FROM "ClassBooking" cb
          JOIN "GymClasses" gc ON gc."classId" = cb."classId"

          UNION ALL

          SELECT s.price, sb."bookedAt", s."gymId", sb."paymentStatus"
          FROM "ServiceBooking" sb
          JOIN "Service" s ON s."serviceId" = sb."serviceId"
        ) b

        INNER JOIN "Gym" g ON g."gymId" = b."gymId" ${ownerFilter}

        WHERE b."paymentStatus" = 'PROCESSED'
        AND (${gymId}::int IS NULL OR b."gymId" = ${gymId})
        AND (${start}::timestamp IS NULL OR b."bookedAt" >= ${start})
        AND (${end}::timestamp IS NULL OR b."bookedAt" <= ${end});
    `;
      return result[0] || { totalRevenue: 0 };
    } catch (error) {
      console.log('Error fetching revenue stats:', error);
      throw new Error('Could not fetch revenue stats');
    }
  }
}
