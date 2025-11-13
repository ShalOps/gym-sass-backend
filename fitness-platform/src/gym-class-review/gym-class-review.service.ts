import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { CreateGymClassReviewDto } from "./dto/create-gym-class-review.dto";
import { UpdateGymClassReviewDto } from "./dto/update-gym-class-review.dto";
import { CreateGymClassReviewResponseDto } from "./dto/create-gym-class-review-response.dto";
import { UpdateGymClassReviewResponseDto } from "./dto/update-gym-class-review-response.dto";
import { Role } from "@prisma/client/wasm";

@Injectable()
export class GymClassReviewsService {
  constructor(private databaseService: DatabaseService) {}

  async createClassReview(userId: number, dto: CreateGymClassReviewDto, userRole: Role) {
    const gymClass = await this.databaseService.gymClasses.findUnique({
      where: { classId: dto.classId },
      include: { gym: true },
    });

    if (!gymClass) throw new NotFoundException('Gym class not found');

    if (userRole !== Role.CUSTOMER) {
      throw new ForbiddenException('Only customers can give class reviews');
    }

    const existing = await this.databaseService.gymClassReview.findFirst({
      where: { classId: dto.classId, userId },
    });

    if (existing) throw new ForbiddenException('You have already reviewed this class');

    // if both comment and  rating are not provided
    if (!dto.comment && !dto.rating) {
      throw new ForbiddenException('At least one of rating or comment must be provided');
    }

    return this.databaseService.gymClassReview.create({
      data: {
        rating: dto.rating,
        comment: dto.comment,
        userId,
        classId: dto.classId,
      },
    });
  }

  async updateClassReview(userId: number, reviewId: number, dto: UpdateGymClassReviewDto,userRole:Role) {
    const review = await this.databaseService.gymClassReview.findUnique({
      where: { id: reviewId },
    });
    if(userRole !== Role.CUSTOMER){
      throw new ForbiddenException('Only customers can update class reviews');
    }

    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId){
      throw new ForbiddenException('You can only update your own review');
    }

    if (dto.rating === undefined && dto.comment === undefined) {
      throw new ForbiddenException('At least one field (rating or comment) must be provided for update');
    }
    return this.databaseService.gymClassReview.update({
      where: { id: reviewId },
      data: dto,
    });
  }

  async deleteClassReview(userId: number, reviewId: number, isAdmin = false) {
    const review = await this.databaseService.gymClassReview.findUnique({
      where: { id: reviewId },
      include: { class: true },
    });

    if (!review) throw new NotFoundException('Review not found');

    if (!isAdmin && review.userId !== userId)
      throw new ForbiddenException('You can delete only your own review');

    return this.databaseService.gymClassReview.delete({
      where: { id: reviewId },
    });
  }

  async createResponse(userId: number, reviewId: number, dto: CreateGymClassReviewResponseDto) {
    const review = await this.databaseService.gymClassReview.findUnique({
        where: { id: reviewId },
        include: { class: { include: { gym: true } } },
    });

    if (!review) throw new NotFoundException('Review not found');

    const gymOwnerId = review.class.gym.gymOwnerId;
    const gymTrainerId = review.class.trainerId;

    if (userId !== gymOwnerId && userId !== gymTrainerId) {
        throw new ForbiddenException('Only the gym owner or the class trainer can respond to this review');
    }

    if( !dto.message || !dto.message.trim()) {
      throw new ForbiddenException('Response message cannot be empty');
    }

    const existingResponse = await this.databaseService.gymClassReviewResponse.findFirst({
        where: { reviewId },
    });

    if (existingResponse) {
        throw new ForbiddenException('Response to this review already exists');
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

  async updateResponse(userId: number, responseId: number, dto: UpdateGymClassReviewResponseDto) {
    const response = await this.databaseService.gymClassReviewResponse.findUnique({
      where: { responseId },
      include: {
        review: { include: { class: { include: { gym: true } } } }, 
      },
    });

    if (!response) throw new NotFoundException('Response not found');

    const gymOwnerId = response.review.class.gym.gymOwnerId; 
    const gymTrainerId = response.review.class.trainerId; 

    if (userId !== gymOwnerId && userId!== gymTrainerId){
      throw new ForbiddenException('Only a gym owner or trainer can create a response');
    }

    if (userId !== response.ownerId){
      throw new ForbiddenException('You can only update your own response');
    }
    if (dto.message === undefined) {
    throw new ForbiddenException('At least one updatable field must be provided (message)');
    }

    if (dto.message === null || !dto.message.trim()) {
      throw new ForbiddenException('Response message cannot be empty');
    }

    return this.databaseService.gymClassReviewResponse.update({
      where: { responseId: responseId },
      data: { message: dto.message },
    });
  }


  async deleteResponse(userId: number, responseId: number, isAdmin = false) {
    const response = await this.databaseService.gymClassReviewResponse.findUnique({
      where: { responseId: responseId },
      include: {
        review: { include: { class: { include: { gym: true } } } },
      },
    });

    if (!response) throw new NotFoundException('Response not found');

    const gymOwnerId = response.review.class.gym.gymOwnerId;
    const gymTrainerId = response.trainerId?? response.review.class.trainerId;

    if (userId !== gymOwnerId && userId !== gymTrainerId)
    throw new ForbiddenException('Only the gym owner or the class trainer can delete responses for this class');

    if (!isAdmin && userId !== response.ownerId)
      throw new ForbiddenException('You can only delete your own response');


    return this.databaseService.gymClassReviewResponse.delete({
      where: { responseId: responseId },
    });
  }

  async getClassReviews(classId: number, page = 1, limit = 10) {
    const MAX_LIMIT = 50;
    const DEFAULT_LIMIT = 10;
    limit = Math.min(limit || DEFAULT_LIMIT, MAX_LIMIT);
    page = Math.max(1, page);

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.databaseService.gymClassReview.findMany({
        where: { classId },
        include: { },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.databaseService.gymClassReview.count({ where: { classId } }),
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
