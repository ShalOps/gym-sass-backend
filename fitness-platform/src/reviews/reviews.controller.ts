import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { GetUser } from "src/common/decorators/get-user.decorator";

@Controller('reviews')
export class ReviewsController {
    constructor(private readonly reviewsService: ReviewsService) {}

    @Post()
    @UseGuards(JwtAuthGuard)
    createReview(
    @Body() dto: CreateReviewDto,
    @GetUser() user: any,  
    ) {
    return this.reviewsService.createReview(user.userId, dto);
    }

}