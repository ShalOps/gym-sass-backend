import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { CreateReviewDto } from "./dto/create-gym-review.dto";
import { UpdateReviewDto } from "./dto/update-gym-review.dto";
import { CreateResponseDto } from "./dto/create-response.dto";
import { UpdateResponseReviewDto } from "./dto/update-response-review.dto";

@Injectable()
export class ReviewsService {
  constructor(private databaseService: DatabaseService) {}

  async createReview(userId: number, dto: CreateReviewDto) {
    const gym = await this.databaseService.gym.findUnique({ where: { gymId: dto.gymId } });
    if (!gym) throw new NotFoundException('Gym not found');

    const existing = await this.databaseService.gymReview.findUnique({
      where: { gymId_userId: { gymId: dto.gymId, userId } },
    });
    if (existing) throw new ForbiddenException('You already reviewed this gym');

    return this.databaseService.gymReview.create({
      data: { ...dto, userId },
    });
  }

  
  async updateReview(userId: number, reviewId: number, dto: UpdateReviewDto) {

    const review = await this.databaseService.gymReview.findUnique({ where: { id: reviewId } });

    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('You can edit only your own review');

    if (!dto.comment && !dto.rating) {
      throw new ForbiddenException('At least one of rating or comment must be provided for update');
    }

    return this.databaseService.gymReview.update({
      where: { id: reviewId },
      data: dto,
    });
  }

   async deleteReview(userId: number, reviewId: number, isAdmin = false) {

    const review = await this.databaseService.gymReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');

    if (!isAdmin && review.userId !== userId)
      throw new ForbiddenException('You can delete only your own review');

    return this.databaseService.gymReview.delete({ where: { id: reviewId } });
  }


  async createResponse(userId: number, reviewId: number, dto: CreateResponseDto) {
    const review = await this.databaseService.gymReview.findUnique({
      where: { id: reviewId },
      include: { gym: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    const gymOwnerId = review.gym.gymOwnerId;
    
    if ( userId!== gymOwnerId) {
      throw new ForbiddenException('only the gym owner can create a response');
    }

    const existingResponse = await this.databaseService.gymReviewResponse.findFirst({
      where: { reviewId },
    }); 
    if (existingResponse) {
      throw new ForbiddenException('Response to this review already exists');
    }

    if (!dto.message || !dto.message.trim()) {
      throw new ForbiddenException('Response message cannot be empty');
    }

    return this.databaseService.gymReviewResponse.create({
      data: {
        message: dto.message,
        reviewId,
        ownerId: userId,
      },
    });
  }

  async updateResponse(userId: number, responseId: number, dto: UpdateResponseReviewDto) {
    const response = await this.databaseService.gymReviewResponse.findUnique({
      where: { responseId: responseId },
      include: { review: { include: { gym: true } } },
    });

    if (!response) throw new NotFoundException('Response not found');
    const gymOwnerId = response.review.gym.gymOwnerId;

    if (userId !== gymOwnerId){
    throw new ForbiddenException('Only a gym owner can create a response');
  }

    if (userId !== response.ownerId){
      throw new ForbiddenException('You can only update your own response');
    }

    if (dto.message === undefined) {
      throw new ForbiddenException('At least one updatable field must be provided (message)');
    }

    if (!dto.message || !dto.message.trim()) {
      throw new ForbiddenException('Response message cannot be empty');
    }

    return this.databaseService.gymReviewResponse.update({
      where: { responseId: responseId },
      data: { message: dto.message },
    });
  }
  async deleteResponse(userId: number, responseId: number, isAdmin = false) {
    const response = await this.databaseService.gymReviewResponse.findUnique({
      where: { responseId: responseId },
      include: { review: { include: { gym: true } } },
      });
      if (!response) throw new NotFoundException('Response not found');

      const gymOwnerId = response.review.gym.gymOwnerId;

      if (!isAdmin && userId !== response.ownerId && userId !== gymOwnerId){
        throw new ForbiddenException('Only the gym owner or admin can manage responses');
      }

        return this.databaseService.gymReviewResponse.delete({ where: { responseId: responseId } });
      }


  async getGymReviews(gymId: number, page = 1, limit = 10) {
    const MAX_LIMIT = 50;
    const DEFAULT_LIMIT = 10;
    limit = Math.min(limit || DEFAULT_LIMIT, MAX_LIMIT);
    page = Math.max(1, page);

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.databaseService.gymReview.findMany({
        where: { gymId },
        include: {
          user: { select: { userName: true, profilePic: true } },
          response: { include: { owner: { select: { userName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.databaseService.gymReview.count({ where: { gymId } }),
    ]);

    return {
      data: reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

}