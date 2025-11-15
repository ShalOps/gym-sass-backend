import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { ReviewsService } from "./gym-reviews.service";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { CreateReviewDto } from "./dto/create-gym-review.dto";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { Role } from "generated/prisma";
import { Roles } from "src/auth/roles.decorator";
import { UpdateReviewDto } from "./dto/update-gym-review.dto";
import { CreateResponseDto } from "./dto/create-response.dto";
import { UpdateResponseReviewDto } from "./dto/update-response-review.dto";
import { PaginationDto } from "./dto/pagination.dto";

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
        @GetUser() user:any,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateReviewDto,
    ) {
        return this.reviewsService.updateReview(user.userId, id, dto);
    }


    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Delete a review (Customer for own, Admin for any)' })
    @ApiParam({ name: 'id', description: 'ID of the review to delete', type: Number })
    @ApiOkResponse({ description: 'Review successfully deleted.' })
    @ApiNotFoundResponse({ description: 'Review not found.' })
    @ApiForbiddenResponse({ description: 'Forbidden. Can only delete own review unless Admin.' })
    delete(
        @GetUser() user: any,
        @Param('id', 
        ParseIntPipe) id: number) {
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
        @GetUser() user: any,
        @Param('id', ParseIntPipe) reviewId: number, 
        @Body() dto: CreateResponseDto,
    ) {
        return this.reviewsService.createResponse(user.userId, reviewId, dto);
    }

    @Delete(':id/response')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.GYMOWNER,Role.ADMIN)
    @ApiOperation({ summary: 'Delete a response to a review (Gym Owner only)' })
    @ApiParam({ name: 'id', description: 'ID of the review to delete response from', type: Number })
    @ApiOkResponse({ description: 'Response successfully deleted.' })
    @ApiNotFoundResponse({ description: 'Response not found.' })
    @ApiForbiddenResponse({ description: 'Forbidden. Can only delete responses for own gym.' })
    deleteResponse(
        @GetUser() user: any,
        @Param('id', ParseIntPipe) responseId: number,
    ) {
        const isAdmin = user.role === Role.ADMIN;
        return this.reviewsService.deleteResponse(user.userId, responseId, isAdmin);
    }
    @Patch(':id/response')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.GYMOWNER)
    @ApiOperation({ summary: 'Update a response to a review (Gym Owner only)' })
    @ApiParam({ name: 'id', description: 'ID of the review to update response for', type: Number })
    @ApiBody({ type: UpdateResponseReviewDto })
    @ApiOkResponse({ description: 'Response successfully updated.' })
    @ApiNotFoundResponse({ description: 'Response not found.' })
    @ApiForbiddenResponse({ description: 'Forbidden. Can only update responses for own gym.' })
    updateResponse(
        @GetUser() user: any,
        @Param('id', ParseIntPipe) responseId: number,
        @Body() dto: UpdateResponseReviewDto,
    ) {
        return this.reviewsService.updateResponse(user.userId, responseId, dto);
    }

    @Get('gym/:gymId')
    @ApiOperation({ summary: 'Get all reviews for a specific gym (Public/Guest access)' })
    @ApiParam({ name: 'gymId', description: 'ID of the gym', type: Number })
    @ApiOkResponse({ description: 'Paginated list of gym reviews.' })
    getGymReviews(
    @Param('gymId', ParseIntPipe) gymId: number,
    @Query() paginationDto: PaginationDto,
    ) {
    return this.reviewsService.getGymReviews(gymId, paginationDto.page, paginationDto.limit);
    }
}