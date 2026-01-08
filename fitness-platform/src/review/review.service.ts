import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { DatabaseService } from 'src/database/database.service';
import { Review } from '@prisma/client';
const PAGE_SIZE = 10;

@Injectable()
export class ReviewService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createReviewDto: CreateReviewDto, userId: number) {
    const check = await this.databaseService.purchasedItem.findUnique({
      where: {
        userId_productId: {
          userId: userId,
          productId: createReviewDto.productId,
        },
      },
    });

    if (!check) {
      throw new BadRequestException(
        'Cannot review a product you have not purchased',
      );
    }

    return await this.databaseService.review.create({
      data: {
        userId,
        productId: createReviewDto.productId,
        comment: createReviewDto.comment,
      },
    });
  }

  paginate(review: Review[]) {
    const hasMore = review.length > PAGE_SIZE;
    const data = hasMore ? review.slice(0, PAGE_SIZE) : review;
    const nextCursor = hasMore ? review[review.length - 1].id : null;

    return { data, hasMore, nextCursor };
  }

  async getProductReviews(productId: number, cursor?: number) {
    const check = await this.databaseService.product.findUnique({
      where: {
        id: productId,
      },
    });

    if (!check) {
      throw new NotFoundException("Product doesn't exist");
    }

    const reviews = await this.databaseService.review.findMany({
      where: {
        productId: productId,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            profilePic: true,
            userName: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
      take: PAGE_SIZE + 1,
    });

    return this.paginate(reviews);
  }
}
