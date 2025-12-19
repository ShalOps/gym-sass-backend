import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { PaginationDto } from './dto/pagination.dto';
import { UpdateUsersDto } from './dto/update-users.dto';
import * as bcrypt from 'bcrypt';
import { DateRangeDto } from './dto/date-range.dto';

@Injectable()
export class UsersService {
  constructor(private readonly databaseservice: DatabaseService) {}

  async findAll(pagination: PaginationDto) {
    const { page, limit, search, location, gender, goal, role } = pagination;
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    if (location) {
      where.location = {
        contains: location,
        mode: 'insensitive' as const,
      };
    }
    if (gender) where.gender = gender;
    if (goal) where.goal = goal;
    if (role) where.role = role;
    const [data, total] = await Promise.all([
      this.databaseservice.user.findMany({
        where,
        skip,
        take: limit,
      }),
      this.databaseservice.user.count({ where }),
    ]);

    const transformedData = data.map((user) => ({
      ...user,
      profilePicUrl: user.profilePic || null,
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
    const user = await this.databaseservice.user.findUnique({
      where: {
        userId: id,
      },
      select: {
        userId: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} id not found`);
    }

    const fullUser = await this.databaseservice.user.findUnique({
      where: {
        userId: id,
      },
    });

    return {
      ...fullUser,
      profilePicUrl: fullUser?.profilePic || null,
    };
  }

  async update(updateUsersDto: UpdateUsersDto, currentUserId: number, isVendor: boolean) {
    
    if (isVendor && updateUsersDto.isVendor === false) {
      throw new BadRequestException("Cannot change back from vendor")
    }
    const user = await this.databaseservice.user.findUnique({
      where: {
        userId: currentUserId,
      },
      select: {
        userId: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${currentUserId} id not found`);
    }

    if (updateUsersDto.password) {
      updateUsersDto.password = await bcrypt.hash(updateUsersDto.password, 10);
    }

    return this.databaseservice.user.update({
      where: {
        userId: currentUserId,
      },
      data: updateUsersDto,
    });
  }

  async remove(currentUserId: number) {
    const user = await this.databaseservice.user.findUnique({
      where: {
        userId: currentUserId,
      },
      select: {
        userId: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${currentUserId} id not found`);
    }

    await this.databaseservice.user.delete({
      where: {
        userId: currentUserId,
      },
    });
  }

  async getUserActivity(
    query: DateRangeDto,
    actingUserId: number,
    isAdmin: boolean,
  ) {
    const { startDate, endDate } = query;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    const customerFilter = isAdmin
      ? Prisma.sql``
      : Prisma.sql`
            INNER JOIN "OwnerCustomers" oc ON u."userId" = oc."userId"
        `;
    try {
      const result = await this.databaseservice.$queryRaw`
      WITH "RelevantBookings" AS (
          SELECT b."userId", b."bookedAt", b."status", g."gymOwnerId"
          FROM "ClassBooking" b
          INNER JOIN "GymClasses" c ON b."classId" = c."classId"
          INNER JOIN "Gym" g ON c."gymId" = g."gymId"
          WHERE (${start}::timestamp IS NULL OR b."bookedAt" >= ${start})
            AND (${end}::timestamp IS NULL OR b."bookedAt" <= ${end})

          UNION ALL

          SELECT b."userId", b."bookedAt", b."status", g."gymOwnerId"
          FROM "ServiceBooking" b
          INNER JOIN "Service" s ON b."serviceId" = s."serviceId"
          INNER JOIN "Gym" g ON s."gymId" = g."gymId"
          WHERE (${start}::timestamp IS NULL OR b."bookedAt" >= ${start})
            AND (${end}::timestamp IS NULL OR b."bookedAt" <= ${end})
      ),
      
      "OwnerCustomers" AS (
          SELECT "userId" FROM "RelevantBookings"
          WHERE "gymOwnerId" = ${actingUserId}
      )
      
      SELECT 
        u."userId",
        u."userName",
        COUNT(b."userId")::int AS totalBookings,
        COUNT(DISTINCT DATE(b."bookedAt"))::int AS activeDays,
        COUNT(CASE WHEN b.status = 'CANCELLED' THEN 1 END)::int AS cancelled,
        COUNT(CASE WHEN b.status = 'COMPLETED' THEN 1 END)::int AS completed

      FROM "User" u
      
      ${customerFilter} 
      
      LEFT JOIN "RelevantBookings" b 
          ON u."userId" = b."userId" 
          AND (${isAdmin} OR b."gymOwnerId" = ${actingUserId})
      
      GROUP BY u."userId", u."userName"
      ORDER BY totalBookings DESC;
    `;

      return result;
    } catch (error) {
      console.log('Error fetching user activity:', error);
      throw new Error('Failed to fetch user activity');
    }
  }
}
