import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
    @GetUser() user: any,
  ) {
    return this.gymClassReviewsService.createClassReview(user.userId, dto);
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
    @GetUser() user,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGymClassReviewDto,
  ) {
    return this.gymClassReviewsService.updateClassReview(user.userId, id, dto);
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
  delete(@GetUser() user, @Param('id', ParseIntPipe) id: number) {
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
    @GetUser() user,
    @Param('id', ParseIntPipe) reviewId: number,
    @Body() dto: CreateGymClassReviewResponseDto,
  ) {
    return this.gymClassReviewsService.addResponse(user.userId, reviewId, dto);
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

  @ApiOkResponse({ description: 'List of gym class reviews.' })
  getClassReviews(@Param('classId', ParseIntPipe) classId: number) {
    return this.gymClassReviewsService.getClassReviews(classId);
  }

  @Patch('responses/:responseId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TRAINER, Role.GYMOWNER)
  @ApiOperation({ summary: 'Update an existing class review response (Trainer only)' })
  @ApiBody({ type: UpdateGymClassReviewResponseDto })
  @ApiOkResponse({ description: 'Response successfully updated.' })
  @ApiForbiddenResponse({
    description: 'Forbidden. You can only update your own response.',
  })
  @ApiNotFoundResponse({ description: 'Response not found.' })
  updateResponse(
    @Param('responseId', ParseIntPipe) responseId: number,
    @GetUser() user: any,
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
    @GetUser() user: any,
  ) {
    const isAdmin = user.role === Role.ADMIN;
    return this.gymClassReviewsService.deleteResponse(
      user.userId,
      responseId,
      isAdmin
    );
  }

}
