import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Add review to product' })
  @ApiBearerAuth('JWT-auth')
  @Post()
  create(@Body() createReviewDto: CreateReviewDto, @Req() req: RequestWithUser) {
    return this.reviewService.create(createReviewDto, req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get all the reviews for a given product' })
  @ApiBearerAuth('JWT-auth')
  getProductReviews(@Param('id') id: string) {
    return this.reviewService.getProductReviews(+id);
  }


}
