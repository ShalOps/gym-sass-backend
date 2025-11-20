import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';



@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}


  @UseGuards(JwtAuthGuard)
  @Get("/older")
  @ApiOperation({ summary: 'Find notifications for a single user ordered by earlier to latest' })
  @ApiBearerAuth('JWT-auth')
  findAll( @Req() req: RequestWithUser) {
    return this.notificationService.findOlder(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/latest')
  @ApiOperation({ summary: 'Find notifications for a single user ordered by latest to earliest' })
  @ApiBearerAuth('JWT-auth')
  findlatest( @Req() req: RequestWithUser) {
    return this.notificationService.findLatest(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/unread')
  @ApiOperation({ summary: 'Get all of the notifications of a single user that haven\'t been read yet' })
  @ApiBearerAuth('JWT-auth')
  findUnread( @Req() req: RequestWithUser) {
    return this.notificationService.findUnread(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/read')
  @ApiOperation({ summary: 'Get all of the notifications of a single user that have been read' })
  @ApiBearerAuth('JWT-auth')
  findRead( @Req() req: RequestWithUser) {
    return this.notificationService.findRead(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update notification to read' })
  @ApiBearerAuth('JWT-auth')
  @Patch(':id/read')
  updateToRead(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.notificationService.updateToRead(+id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiBearerAuth('JWT-auth')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.notificationService.remove(+id, req.user.userId);
  }
}
