import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateRatingDto } from './dto/create-rating.dto';
import { DatabaseService } from 'src/database/database.service';
const validRatings = [1, 2, 3, 4, 5];
@Injectable()
export class RatingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createRatingDto: CreateRatingDto, userId: number) {
    const check = await this.databaseService.purchasedItem.findUnique({
      where: {
        userId_productId: {
          userId: userId,
          productId: createRatingDto.productId,
        },
      },
    });

    if (!check) {
      throw new BadRequestException(
        'Cannot rate a product you have not purchased',
      );
    }

    if (!validRatings.includes(createRatingDto.rating)) {
      throw new BadRequestException(
        'Rating value must be on of these values (1,2,3,4,5)',
      );
    }

    const checkRating = await this.databaseService.rating.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: createRatingDto.productId,
        },
      },
    });

    if (checkRating) {
      return await this.databaseService.rating.update({
        where: {
          userId_productId: {
            userId,
            productId: createRatingDto.productId,
          },
        },
        data: {
          rating: createRatingDto.rating,
        },
      });
    }

    return await this.databaseService.rating.create({
      data: {
        userId,
        productId: createRatingDto.productId,
        rating: createRatingDto.rating,
      },
    });
  }

  async getProductRatingStats(productId: number) {
    const check = await this.databaseService.product.findUnique({
      where: {
        id: productId,
      },
    });

    if (!check) {
      throw new NotFoundException('Product does not exist');
    }

    const stats = await this.databaseService.rating.aggregate({
      where: {
        productId: productId,
      },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    });

    return {
      averageRating: stats._avg.rating
        ? parseFloat(stats._avg.rating.toFixed(1))
        : 0,
      totalRatings: stats._count.rating,
    };
  }

  async getRatingDistribution(productId: number) {
    const check = await this.databaseService.product.findUnique({
      where: {
        id: productId,
      },
    });

    if (!check) {
      throw new NotFoundException('Product does not exist');
    }

    const distribution = await this.databaseService.rating.groupBy({
      by: ['rating'],
      where: {
        productId: productId,
      },
      _count: {
        rating: true,
      },
    });

    return distribution;
  }
}
