import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { DatabaseService } from 'src/database/database.service';
import { Favorite } from '@prisma/client';
const PAGE_SIZE = 10;

@Injectable()
export class FavoriteService {
  constructor(private readonly databaseService: DatabaseService) {}

  async toggleFavorite(createFavoriteDto: CreateFavoriteDto, userId: number) {
    const checkProduct = await this.databaseService.product.findUnique({
      where: {
        id: createFavoriteDto.productId,
      },
    });

    if (!checkProduct) {
      throw new NotFoundException('Product does not exist');
    }
    const checkFavoriteStatus = await this.databaseService.favorite.findUnique({
      where: {
        productId_userId: {
          productId: createFavoriteDto.productId,
          userId,
        },
      },
    });

    if (checkFavoriteStatus) {
      return await this.databaseService.favorite.delete({
        where: {
          productId_userId: {
            productId: createFavoriteDto.productId,
            userId,
          },
        },
      });
    } else {
      return await this.databaseService.favorite.create({
        data: {
          ...createFavoriteDto,
          userId,
        },
      });
    }
  }

  paginate(favorite: Favorite[]) {
    const hasMore = favorite.length > PAGE_SIZE;
    const data = hasMore ? favorite.slice(0, PAGE_SIZE) : favorite;
    const nextCursor = hasMore ? favorite[favorite.length - 1].id : null;

    return { data, hasMore, nextCursor };
  }

  async findAll(userId: number, cursor?: number) {
    const checkFavorites = await this.databaseService.favorite.findMany({
      where: {
        userId: userId,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: {
        id: 'asc',
      },
      take: PAGE_SIZE + 1,
    });

    return this.paginate(checkFavorites);
  }
}
