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
    const {
      page,
      limit,
      search,
      location,
      gender,
      goal,
      role,
      birthDateFrom,
      birthDateTo,
    } = pagination;
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
    if (birthDateFrom || birthDateTo) {
      where.birthDate = {};
      if (birthDateFrom) where.birthDate.gte = new Date(birthDateFrom);
      if (birthDateTo) where.birthDate.lte = new Date(birthDateTo);
    }
    const [data, total] = await Promise.all([
      this.databaseservice.user.findMany({
        where,
        skip,
        take: limit,
      }),
      this.databaseservice.user.count({ where }),
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
