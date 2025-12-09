import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, UnauthorizedException, Headers } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';
import {  ApiBearerAuth } from '@nestjs/swagger';
import { DatabaseService } from 'src/database/database.service';
import { TelegramUpdateDto } from './dto/telegram.dto';



@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService, private readonly databaseService: DatabaseService) {}

    
  @UseGuards(JwtAuthGuard)
  @Get('connect')
  @ApiBearerAuth('JWT-auth')
  connect(@Req() req: RequestWithUser) {
    const link = this.telegramService.generateStartLink(req.user.userId);
    return { link, message: 'Click the link to start receiving notifications on Telegram' };
  }

  @Post('webhook')
  async webhook(@Body() body: TelegramUpdateDto, @Headers('x-telegram-bot-api-secret-token') secretToken: string | undefined) {
    
    if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    throw new UnauthorizedException('Invalid webhook secret');
  }

    const message = body.message;
    if (!message?.text?.startsWith('/start ')) return { ok: true };

    const chatId = BigInt(message.chat.id);
    const payload = message.text.split(' ')[1];

    const userId = Number(Buffer.from(payload, 'base64url').toString());

    if (!userId || isNaN(userId)) return { ok: true };

    await this.databaseService.user.update({
      where: { userId },
      data: { telegramChatId: chatId },
    });

    await this.telegramService.sendMessage(chatId, '✅ Connected!\nYou will now receive all your notifications here.', userId);

    return { ok: true };
  }
}
