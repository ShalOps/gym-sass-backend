import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { DatabaseService } from 'src/database/database.service';
import { PaginationDto } from './dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(private readonly databaseservice: DatabaseService) {}

  async create(createUserDto: Prisma.UserCreateInput) {
    return this.databaseservice.user.create({
      data: createUserDto,
    });
  }

  async findAll(pagination: PaginationDto) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.databaseservice.user.findMany({
        skip,
        take: limit,
      }),
      this.databaseservice.user.count(),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    return this.databaseservice.user.findUnique({
      where: {
        userId: id,
      },
    });
  }

  async update(id: number, updateUserDto: Prisma.UserUpdateInput) {
    return this.databaseservice.user.update({
      where: {
        userId: id,
      },
      data: updateUserDto,
    });
  }

  async remove(id: number) {
    return this.databaseservice.user.delete({
      where: {
        userId: id,
      },
    });
  }
}
