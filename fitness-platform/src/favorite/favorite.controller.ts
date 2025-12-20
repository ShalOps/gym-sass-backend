import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { FavoriteService } from './favorite.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('favorite')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}


  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Toggle favorite (if favorite exists deletes it otherwise creates favorite)' })
  @ApiBearerAuth('JWT-auth')
  toggleFavorite(@Body() createFavoriteDto: CreateFavoriteDto, @Req() req: RequestWithUser) {
    return this.favoriteService.toggleFavorite(createFavoriteDto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get a users list of favorites' })
  @ApiBearerAuth('JWT-auth')
  findAll(@Req() req: RequestWithUser) {
    return this.favoriteService.findAll(req.user.userId);
  }

}
