import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { DatabaseService } from 'src/database/database.service';
import { PaginationDto } from './dto/pagination.dto';

@Injectable()
export class GymsService {
  constructor(private readonly databaseservice: DatabaseService) {}

  create(createGymDto: Prisma.GymCreateInput) {
    return this.databaseservice.gym.create({
      data: createGymDto,
    });
  }

  async findAll(pagination: PaginationDto) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.databaseservice.gym.findMany({
        skip,
        take: limit,
      }),
      this.databaseservice.gym.count(),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  findOne(id: number) {
    return this.databaseservice.gym.findUnique({
      where: {
        gymId: id,
      },
    });
  }

  update(id: number, updateGymDto: Prisma.GymUpdateInput) {
    return this.databaseservice.gym.update({
      where: {
        gymId: id,
      },
      data: updateGymDto,
    });
  }

  remove(id: number) {
    return this.databaseservice.gym.delete({
      where: {
        gymId: id,
      },
    });
  }
}
