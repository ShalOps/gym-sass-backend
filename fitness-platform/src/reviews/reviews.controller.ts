import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { ReviewsService } from "./reviews.service";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { CreateReviewDto } from "./dto/create-review.dto";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { Role } from "generated/prisma";
import { Roles } from "src/common/decorators/roles.decorator";
import { UpdateReviewDto } from "./dto/update-review.dto";
import { CreateResponseDto } from "./dto/create-response.dto";

@ApiTags('Reviews') 
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
    constructor(private readonly reviewsService: ReviewsService) {}

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Create a new gym review (Customer only)' })
    @ApiBody({ type: CreateReviewDto })
    @ApiOkResponse({ description: 'Review successfully created.' })
    @ApiForbiddenResponse({ description: 'Forbidden. User already reviewed this gym.' })
    createReview(
        @Body() dto: CreateReviewDto,
        @GetUser() user: any, 
    ) {
        
        return this.reviewsService.createReview(user.userId, dto);
    }


    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.CUSTOMER)
    @ApiOperation({ summary: 'Update an existing review (Customer only)' })
    @ApiParam({ name: 'id', description: 'ID of the review to update', type: Number })
    @ApiBody({ type: UpdateReviewDto })
    @ApiOkResponse({ description: 'Review successfully updated.' })
    @ApiNotFoundResponse({ description: 'Review not found.' })
    @ApiForbiddenResponse({ description: 'Forbidden. Can only update own review.' })
    update(
        @GetUser('userId') userId: number,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateReviewDto,
    ) {
        return this.reviewsService.updateReview(userId, id, dto);
    }


    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Delete a review (Customer for own, Admin for any)' })
    @ApiParam({ name: 'id', description: 'ID of the review to delete', type: Number })
    @ApiOkResponse({ description: 'Review successfully deleted.' })
    @ApiNotFoundResponse({ description: 'Review not found.' })
    @ApiForbiddenResponse({ description: 'Forbidden. Can only delete own review unless Admin.' })
    delete(@GetUser() user, @Param('id', ParseIntPipe) id: number) {
        const isAdmin = user.role === Role.ADMIN;
        return this.reviewsService.deleteReview(user.userId, id, isAdmin);
    }


    @Post(':id/response')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.GYMOWNER)
    @ApiOperation({ summary: 'Add a response to a review (Gym Owner only)' })
    @ApiParam({ name: 'id', description: 'ID of the review to respond to', type: Number })
    @ApiBody({ type: CreateResponseDto })
    @ApiOkResponse({ description: 'Response successfully added.' })
    @ApiNotFoundResponse({ description: 'Review not found.' })
    @ApiForbiddenResponse({ description: 'Forbidden. Can only respond to reviews for own gym.' })
    addResponse(
        @GetUser('userId') ownerId: number,
        @Param('id', ParseIntPipe) reviewId: number, 
        @Body() dto: CreateResponseDto,
    ) {
        return this.reviewsService.addResponse(ownerId, reviewId, dto);
    }

    @Get('gym/:gymId')
    @ApiOperation({ summary: 'Get all reviews for a specific gym (Public/Guest access)' })
    @ApiParam({ name: 'gymId', description: 'ID of the gym', type: Number })
    @ApiOkResponse({ description: 'List of gym reviews.' })
    getGymReviews(@Param('gymId', ParseIntPipe) gymId: number) { 
        return this.reviewsService.getGymReviews(gymId);
    }
}