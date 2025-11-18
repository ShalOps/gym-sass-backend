import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { GymClassReviewsService } from './gym-class-review.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateGymClassReviewDto } from './dto/create-gym-class-review.dto';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Role } from 'generated/prisma';
import { Roles } from 'src/auth/roles.decorator';
import { UpdateGymClassReviewDto } from './dto/update-gym-class-review.dto';
import { CreateGymClassReviewResponseDto } from './dto/create-gym-class-review-response.dto';
import { UpdateGymClassReviewResponseDto } from './dto/update-gym-class-review-response.dto';
import { PaginationDto } from './dto/pagination.dto';
import type { User } from '@prisma/client';

@ApiTags('Gym Class Reviews')
@ApiBearerAuth()
@Controller('class-reviews')
export class GymClassReviewsController {
  constructor(
    private readonly gymClassReviewsService: GymClassReviewsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Create a new class review (Customer only)' })
  @ApiBody({ type: CreateGymClassReviewDto })
  @ApiOkResponse({ description: 'Class review successfully created.' })
  @ApiForbiddenResponse({
    description: 'Forbidden. User already reviewed this class.',
  })
  createClassReview(
    @Body() dto: CreateGymClassReviewDto,
    @GetUser() user: User,
  ) {
    return this.gymClassReviewsService.createClassReview(
      user.userId,
      dto,
      user.role,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Update an existing class review (Customer only)' })
  @ApiParam({
    name: 'id',
    description: 'ID of the class review to update',
    type: Number,
  })
  @ApiBody({ type: UpdateGymClassReviewDto })
  @ApiOkResponse({ description: 'Class review successfully updated.' })
  @ApiNotFoundResponse({ description: 'Class review not found.' })
  @ApiForbiddenResponse({
    description: 'Forbidden. Can only update own class review.',
  })
  update(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGymClassReviewDto,
  ) {
    return this.gymClassReviewsService.updateClassReview(
      user.userId,
      id,
      dto,
      user.role,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER, Role.ADMIN)
  @ApiOperation({
    summary: 'Delete a class review (Customer for own, Admin for any)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID of the class review to delete',
    type: Number,
  })
  @ApiOkResponse({ description: 'Class review successfully deleted.' })
  @ApiNotFoundResponse({ description: 'Class review not found.' })
  @ApiForbiddenResponse({
    description: 'Forbidden. Can only delete own review unless Admin.',
  })
  delete(@GetUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const isAdmin = user.role === Role.ADMIN;
    return this.gymClassReviewsService.deleteClassReview(
      user.userId,
      id,
      isAdmin,
    );
  }

  @Post(':id/response')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TRAINER, Role.GYMOWNER)
  @ApiOperation({
    summary: 'Add a response to a class review (Trainer or Gym Owner only)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID of the class review to respond to',
    type: Number,
  })
  @ApiBody({ type: CreateGymClassReviewResponseDto })
  @ApiOkResponse({ description: 'Response successfully added.' })
  @ApiNotFoundResponse({ description: 'Class review not found.' })
  @ApiForbiddenResponse({
    description: 'Forbidden. Can only respond to reviews for own class.',
  })
  addResponse(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) reviewId: number,
    @Body() dto: CreateGymClassReviewResponseDto,
  ) {
    return this.gymClassReviewsService.createResponse(
      user.userId,
      reviewId,
      dto,
    );
  }

  @Get('class/:classId')
  @ApiOperation({
    summary: 'Get all reviews for a specific class (Public/Guest access)',
  })
  @ApiParam({
    name: 'classId',
    description: 'ID of the gym class',
    type: Number,
  })
  @ApiOkResponse({ description: 'Paginated list of gym class reviews.' })
  getClassReviews(
    @Param('classId', ParseIntPipe) classId: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.gymClassReviewsService.getClassReviews(
      classId,
      paginationDto.page,
      paginationDto.limit,
    );
  }

  @Patch('responses/:responseId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TRAINER, Role.GYMOWNER)
  @ApiOperation({
    summary: 'Update an existing class review response (Trainer only)',
  })
  @ApiBody({ type: UpdateGymClassReviewResponseDto })
  @ApiOkResponse({ description: 'Response successfully updated.' })
  @ApiForbiddenResponse({
    description: 'Forbidden. You can only update your own response.',
  })
  @ApiNotFoundResponse({ description: 'Response not found.' })
  updateResponse(
    @GetUser() user: User,
    @Param('responseId', ParseIntPipe) responseId: number,
    @Body() dto: UpdateGymClassReviewResponseDto,
  ) {
    return this.gymClassReviewsService.updateResponse(
      user.userId,
      responseId,
      dto,
    );
  }

  @Delete('responses/:responseId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TRAINER, Role.GYMOWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a class review response (Trainer only)' })
  @ApiOkResponse({ description: 'Response successfully deleted.' })
  @ApiForbiddenResponse({
    description: 'Forbidden. You can only delete your own response.',
  })
  @ApiNotFoundResponse({ description: 'Response not found.' })
  deleteResponse(
    @Param('responseId', ParseIntPipe) responseId: number,
    @GetUser() user: User,
  ) {
    const isAdmin = user.role === Role.ADMIN;
    return this.gymClassReviewsService.deleteResponse(
      user.userId,
      responseId,
      isAdmin,
    );
  }
}
