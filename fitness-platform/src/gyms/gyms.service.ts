import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { PaginationDto } from './dto/pagination.dto';
import { CreateGymsDto } from './dto/create-gyms.dto';
import { UpdateGymsDto } from './dto/update-gyms.dto';
import { NotificationType } from '@prisma/client';
import { Role } from '@prisma/client';

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

    return await this.databaseservice.$transaction( async (tx) => {
       
      const newGym = await tx.gym.create({
        data: { ...createGymsDto, gymOwnerId: currentUserId },
      });

      const adminIdList = await tx.user.findMany({
        where: {
          role: Role.ADMIN
        },
        select: {
          userId: true
        }
      })
      for (const adminId of adminIdList){
        await tx.notification.create({
          data:
          {
            userId: adminId.userId,
            type: NotificationType.NEW_GYM_CREATED,
            message: `Gym with gym name ${newGym.gymName} was created by a user check credentials and update verification`,
          }
        })
      }
  
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
}