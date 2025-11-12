import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { CreateReviewDto } from "./dto/create-gym-review.dto";
import { UpdateReviewDto } from "./dto/update-gym-review.dto";
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

     if (!dto.comment && !dto.rating) {
      throw new ForbiddenException('At least one of rating or comment must be provided');
    }

    return this.databaseservice.gymReview.create({
      data: { ...dto, userId },
    });
  }

  
  async updateReview(userId: number, reviewId: number, dto: UpdateReviewDto) {

    const review = await this.databaseservice.gymReview.findUnique({ where: { id: reviewId } });

    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('You can edit only your own review');

    if (!dto.comment && !dto.rating) {
      throw new ForbiddenException('At least one of rating or comment must be provided for update');
    }

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

    const existingResponse = await this.databaseservice.gymReviewResponse.findFirst({
      where: { reviewId },
    }); 
    if (existingResponse) {
      throw new ForbiddenException('Response to this review already exists');
    }

    if (review.gym.gymOwnerId !== ownerId) {
      throw new ForbiddenException('You can only respond to reviews for your own gym');
    }

    if (!dto.message || dto.message.trim().length === 0) {
      throw new ForbiddenException('Response message cannot be empty');
    }

    return this.databaseservice.gymReviewResponse.create({
      data: {
        message: dto.message,
        reviewId,
        ownerId,
      },
    });
  }

  async updateResponse(ownerId: number, responseId: number, dto: CreateResponseDto) {
    const response = await this.databaseservice.gymReviewResponse.findUnique({
      where: { responseId: responseId },
      include: { review: { include: { gym: true } } },
    });

    if (!response) throw new NotFoundException('Response not found');
    if (response.ownerId !== ownerId) {
      throw new ForbiddenException('You can only update your own response');
    }
    if (!dto.message || dto.message.trim().length === 0) {
      throw new ForbiddenException('Response message cannot be empty');
    }

    return this.databaseservice.gymReviewResponse.update({
      where: { responseId: responseId },
      data: { message: dto.message },
    });
  }
  async deleteResponse(ownerId: number, responseId: number) {
    const response = await this.databaseservice.gymReviewResponse.findUnique({
      where: { responseId: responseId },
      include: { review: { include: { gym: true } } },
      });
      if (!response) throw new NotFoundException('Response not found');

      if (response.ownerId !== ownerId) {
        throw new ForbiddenException('You can only delete your own response');
      }

      return this.databaseservice.gymReviewResponse.delete({ where: { responseId: responseId } });
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