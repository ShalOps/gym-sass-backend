import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  Query,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  private parseCursor(cursor?: string): number | undefined {
    if (!cursor) return undefined;
    const parsed = Number(cursor);
    if (isNaN(parsed) || parsed <= 0) {
      throw new BadRequestException('cursor must be a positive number');
    }
    return parsed;
  }

  @UseGuards(JwtAuthGuard)
  @Get('/older')
  @ApiOperation({
    summary:
      'Find notifications for a single user ordered by earlier to latest',
  })
  @ApiBearerAuth('JWT-auth')
  findOlder(@Req() req: RequestWithUser, @Query('cursor') cursor?: string) {
    return this.notificationService.findOlder(
      req.user.userId,
      this.parseCursor(cursor),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('/latest')
  @ApiOperation({
    summary:
      'Find notifications for a single user ordered by latest to earliest',
  })
  @ApiBearerAuth('JWT-auth')
  findlatest(@Req() req: RequestWithUser, @Query('cursor') cursor?: string) {
    return this.notificationService.findLatest(
      req.user.userId,
      this.parseCursor(cursor),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('/unread')
  @ApiOperation({
    summary:
      "Get all of the notifications of a single user that haven't been read yet",
  })
  @ApiBearerAuth('JWT-auth')
  findUnread(@Req() req: RequestWithUser, @Query('cursor') cursor?: string) {
    return this.notificationService.findUnread(
      req.user.userId,
      this.parseCursor(cursor),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('/read')
  @ApiOperation({
    summary:
      'Get all of the notifications of a single user that have been read',
  })
  @ApiBearerAuth('JWT-auth')
  findRead(@Req() req: RequestWithUser, @Query('cursor') cursor?: string) {
    return this.notificationService.findRead(
      req.user.userId,
      this.parseCursor(cursor),
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update notification to read' })
  @ApiBearerAuth('JWT-auth')
  @Patch(':id/read')
  updateToRead(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.notificationService.updateToRead(+id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-read')
  @ApiOperation({
    summary: 'Permanently delete all READ notifications of the current user',
  })
  @ApiBearerAuth('JWT-auth')
  async deleteAllRead(@Req() req: RequestWithUser) {
    return this.notificationService.deleteAllRead(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiBearerAuth('JWT-auth')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.notificationService.remove(+id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('mark-all-read')
  @ApiOperation({
    summary: 'Mark every notification of the current user as READ',
  })
  @ApiBearerAuth('JWT-auth')
  async markAllAsRead(@Req() req: RequestWithUser) {
    return this.notificationService.markAllAsRead(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  @ApiOperation({ summary: 'Get the number of unread notifications' })
  @ApiBearerAuth('JWT-auth')
  async getUnreadCount(@Req() req: RequestWithUser) {
    return this.notificationService.getUnreadCount(req.user.userId);
  }
}
