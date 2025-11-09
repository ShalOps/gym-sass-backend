import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { CreateGymClassReviewDto } from "./dto/create-gym-class-review.dto";
import { UpdateGymClassReviewDto } from "./dto/update-gym-class-review.dto";
import { CreateGymClassReviewResponseDto } from "./dto/create-gym-class-review-response.dto";

@Injectable()
export class GymClassReviewsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createClassReview(userId: number, dto: CreateGymClassReviewDto) {
    const gymClass = await this.databaseService.gymClasses.findUnique({
      where: { classId: dto.classId },
      include: { gym: true },
    });

    if (!gymClass) throw new NotFoundException('Gym class not found');

    const existing = await this.databaseService.gymClassReview.findUnique({
      where: { classId_userId: { classId: dto.classId, userId } },
    });

    if (existing) throw new ForbiddenException('You have already reviewed this class');

    return this.databaseService.gymClassReview.create({
      data: {
        rating: dto.rating,
        comment: dto.comment,
        userId,
        classId: dto.classId,
      },
    });
  }

  async updateClassReview(userId: number, reviewId: number, dto: UpdateGymClassReviewDto) {
    const review = await this.databaseService.gymClassReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId)
      throw new ForbiddenException('You can only update your own review');

    return this.databaseService.gymClassReview.update({
      where: { id: reviewId },
      data: dto,
    });
  }

  async deleteClassReview(userId: number, reviewId: number, isAdmin = false) {
    const review = await this.databaseService.gymClassReview.findUnique({
      where: { id: reviewId },
      include: { gymClass: true },
    });

    if (!review) throw new NotFoundException('Review not found');

    if (!isAdmin && review.userId !== userId)
      throw new ForbiddenException('You can delete only your own review');

    return this.databaseService.gymClassReview.delete({
      where: { id: reviewId },
    });
  }

  async addResponse(userId: number, reviewId: number, dto: CreateGymClassReviewResponseDto) {
    const review = await this.databaseService.gymClassReview.findUnique({
        where: { id: reviewId },
        include: { gymClass: { include: { gym: true } } },
    });

    if (!review) throw new NotFoundException('Review not found');

    const gymOwnerId = review.gymClass.gym.gymOwnerId;
    const gymTrainerId = review.gymClass.gym.gymTrainerId;

    if (userId !== gymOwnerId && userId !== gymTrainerId) {
        throw new ForbiddenException('You can only respond to reviews for your own gym classes');
    }

    const isOwner = userId === gymOwnerId;
    const isTrainer = userId === gymTrainerId;

    return this.databaseService.gymClassReviewResponse.create({
        data: {
        message: dto.message,
        reviewId,
        ownerId: isOwner ? userId : null,
        trainerId: isTrainer ? userId : null,
        },
    });
    }


  async getClassReviews(classId: number) {
    return this.databaseService.gymClassReview.findMany({
        where: { classId },
        include: {
        user: { select: { userName: true, profilePic: true } },
        response: {
            include: {
            owner: { select: { userName: true } },
            trainer: { select: { userName: true } },
            },
        },
        },
        orderBy: { createdAt: 'desc' },
        });
    }

}
