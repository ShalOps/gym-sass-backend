import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  private parseCursor(cursor?: string): number | undefined {
    if (!cursor) return undefined;
    const parsed = Number(cursor);
    if (isNaN(parsed) || parsed <= 0) {
      throw new BadRequestException('cursor must be a positive number');
    }
    return parsed;
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add review to product' })
  @ApiBearerAuth('JWT-auth')
  @Post()
  create(
    @Body() createReviewDto: CreateReviewDto,
    @Req() req: RequestWithUser,
  ) {
    return this.reviewService.create(createReviewDto, req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get all the reviews for a given product' })
  @ApiBearerAuth('JWT-auth')
  getProductReviews(@Param('id') id: string, @Query('cursor') cursor?: string) {
    return this.reviewService.getProductReviews(+id, this.parseCursor(cursor));
  }
}
