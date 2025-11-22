import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service'; 
import { PaginationDto } from './dto/pagination.dto';
import { CreateGymsDto } from './dto/create-gyms.dto';
import { UpdateGymsDto } from './dto/update-gyms.dto';
import { DateRangeDto } from './dto/date-range.dto';

@Injectable()
export class GymsService {
  constructor(private readonly databaseservice: DatabaseService) {}

  async create(createGymsDto: CreateGymsDto, currentUserId: number) {
    const gymOwner = await this.databaseservice.user.findUnique({
      where: {
        userId: currentUserId,
      },
      select: {
        userId: true,
        role: true,
      },
    });

    if (!gymOwner) {
      throw new NotFoundException(`User with ID ${currentUserId} not found`);
    }
    if (gymOwner.role !== 'GYMOWNER') {
      throw new ForbiddenException(
        `User with ID ${currentUserId} is not a Gym owner`,
      );
    }

    return this.databaseservice.gym.create({
      data: { ...createGymsDto, gymOwnerId: currentUserId },
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

async getTotalBookings(query: DateRangeDto, actingUserId: number, isAdmin: boolean) {
    const { gymId, startDate, endDate } = query;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const ownerFilter = isAdmin 
      ? Prisma.sql``
      : Prisma.sql`AND g."gymOwnerId" = ${actingUserId}`;

    const result = await this.databaseservice.$queryRaw<{ total: number }[]>`
      SELECT
        (
          SELECT COUNT(*)::int FROM "ClassBooking" cb
          JOIN "GymClasses" gc ON gc."classId" = cb."classId"
          JOIN "Gym" g ON g."gymId" = gc."gymId"
          WHERE (${gymId}::int IS NULL OR gc."gymId" = ${gymId})
          AND (${start}::timestamp IS NULL OR cb."bookedAt" >= ${start})
          AND (${end}::timestamp IS NULL OR cb."bookedAt" <= ${end})
          ${ownerFilter}
        ) +
        (
          SELECT COUNT(*)::int FROM "ServiceBooking" sb
          JOIN "Service" s ON s."serviceId" = sb."serviceId"
          JOIN "Gym" g ON g."gymId" = s."gymId"
          WHERE (${gymId}::int IS NULL OR s."gymId" = ${gymId})
          AND (${start}::timestamp IS NULL OR sb."bookedAt" >= ${start})
          AND (${end}::timestamp IS NULL OR sb."bookedAt" <= ${end})
          ${ownerFilter}
        ) AS total;
    `;

    return (result && result.length > 0) ? result[0] : { total: 0 };
  }

  async getMonthlyBookings(query: DateRangeDto, actingUserId: number, isAdmin: boolean) {
    const { gymId, startDate, endDate } = query;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const ownerFilter = isAdmin 
      ? Prisma.sql``
      : Prisma.sql`AND g."gymOwnerId" = ${actingUserId}`;
    
    return this.databaseservice.$queryRaw`
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
      WHERE (${gymId}::int IS NULL OR b."gymId" = ${gymId})
      AND (${start}::timestamp IS NULL OR b."bookedAt" >= ${start})
      AND (${end}::timestamp IS NULL OR b."bookedAt" <= ${end})${ownerFilter}
      GROUP BY period
      ORDER BY period ASC;
    `;
  }

  async getWeeklyBookings(query: DateRangeDto, actingUserId: number, isAdmin: boolean) {
    const { gymId, startDate, endDate } = query;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const ownerFilter = isAdmin 
      ? Prisma.sql``
      : Prisma.sql`AND g."gymOwnerId" = ${actingUserId}`;

    return this.databaseservice.$queryRaw`
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
      WHERE (${gymId}::int IS NULL OR b."gymId" = ${gymId})
      AND (${start}::timestamp IS NULL OR b."bookedAt" >= ${start})
      AND (${end}::timestamp IS NULL OR b."bookedAt" <= ${end})${ownerFilter}
      GROUP BY weekStart
      ORDER BY weekStart ASC;
    `;
  }

  async getRevenueStats(query: DateRangeDto, actingUserId: number, isAdmin: boolean) {
    const { gymId, startDate, endDate } = query;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const ownerFilter = isAdmin 
      ? Prisma.sql``
      : Prisma.sql`AND b."gymId" IN (
          SELECT g."gymId" FROM "Gym" g WHERE g."gymOwnerId" = ${actingUserId}
        )`;
    const result = await this.databaseservice
      .$queryRaw<{ totalRevenue: number }[]>`
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
      WHERE b."paymentStatus" = 'PROCESSED'
      AND (${gymId}::int IS NULL OR b."gymId" = ${gymId})
      AND (${start}::timestamp IS NULL OR b."bookedAt" >= ${start})
      AND (${end}::timestamp IS NULL OR b."bookedAt" <= ${end})${ownerFilter};
    `;

    return result[0] || { totalRevenue: 0 };
  }
}