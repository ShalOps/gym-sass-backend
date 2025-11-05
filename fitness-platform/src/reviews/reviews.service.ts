import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { CreateReviewDto } from "./dto/create-review.dto";

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
}