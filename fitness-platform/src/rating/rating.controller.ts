import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { RatingService } from './rating.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { UpdateRatingDto } from './dto/update-rating.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('rating')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}




  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Add rating to product' })
  @ApiBearerAuth('JWT-auth')
  create(@Body() createRatingDto: CreateRatingDto, @Req() req: RequestWithUser) {
    return this.ratingService.create(createRatingDto, req.user.userId);
  }


  @Get(':id')
  @ApiOperation({ summary: 'Get average rating value for a given product' })
  @ApiBearerAuth('JWT-auth')
  getProductRatingStats(@Param('id') id: string) {
    return this.ratingService.getProductRatingStats(+id);
  }

  @Get('distribution/:id')
  @ApiOperation({ summary: 'Get rating distribution for a given product' })
  @ApiBearerAuth('JWT-auth')
  getRatingDistribution(@Param('id') id: string) {
    return this.ratingService.getRatingDistribution(+id);
  }
}
