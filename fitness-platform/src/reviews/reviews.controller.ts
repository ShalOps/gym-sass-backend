import { Body, Controller, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { Role } from "generated/prisma";
import { UpdateReviewDto } from "./dto/update-review.dto";

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

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.CUSTOMER)
    @Patch(':id')
    update(
        @GetUser('userId') userId: number,
        @Param('id') id: string,
        @Body() dto: UpdateReviewDto,
    ) {
        return this.reviewsService.updateReview(userId, +id, dto);
    }

}