import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { UpdateReviewDto } from "./dto/update-review.dto";
import { CreateResponseDto } from "./dto/create-response.dto";

@Injectable()
export class ReviewsService {
  constructor(private databaseservice: DatabaseService) {}

  async createReview(userId: number, dto: CreateReviewDto) {
    const gym = await this.databaseservice.gym.findUnique({ where: { gymId: dto.gymId } });
    if (!gym) throw new NotFoundException('Gym not found');

    const existing = await this.databaseservice.gymReview.findUnique({
      where: { gymId_userId: { gymId: dto.gymId, userId } },
    });
    if (existing) throw new ForbiddenException('You already reviewed this gym');


    return this.databaseservice.gymReview.create({
      data: { ...dto, userId },
    });
  }

  
  async updateReview(userId: number, reviewId: number, dto: UpdateReviewDto) {

    const review = await this.databaseservice.gymReview.findUnique({ where: { id: reviewId } });

    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('You can edit only your own review');

    return this.databaseservice.gymReview.update({
      where: { id: reviewId },
      data: dto,
    });
  }

   async deleteReview(userId: number, reviewId: number, isAdmin = false) {

    const review = await this.databaseservice.gymReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');

    if (!isAdmin && review.userId !== userId)
      throw new ForbiddenException('You can delete only your own review');

    return this.databaseservice.gymReview.delete({ where: { id: reviewId } });
  }


  async addResponse(ownerId: number, reviewId: number, dto: CreateResponseDto) {
    const review = await this.databaseservice.gymReview.findUnique({
      where: { id: reviewId },
      include: { gym: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.gym.gymOwnerId !== ownerId)
      throw new ForbiddenException('You can only respond to reviews for your own gym');

    return this.databaseservice.gymReviewResponse.create({
      data: {
        message: dto.message,
        reviewId,
        ownerId,
      },
    });
  }

  async getGymReviews(gymId: number) {
    return this.databaseservice.gymReview.findMany({
      where: { gymId },
      include: {
        user: { select: { userName: true, profilePic: true } },
        response: { include: { owner: { select: { userName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

}