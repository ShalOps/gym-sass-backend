import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  Patch,
  Delete,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ReportMessageDto } from './dto/report-message.dto';
import { BroadcastMessageDto } from './dto/broadcast-message.dto';
import { TelegramFallbackDto } from './dto/telegram-fallback.dto';
import { MuteConversationDto } from './dto/mute-conversation.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConversationContext } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UPLOADS_DIR_ABSOLUTE } from '../config/paths.config';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync } from 'fs';

const uuidv4Typed: () => string = uuidv4;

@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('conversations')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Create or get a conversation' })
  @ApiCreatedResponse({
    description: 'The conversation has been successfully created or retrieved.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  createConversation(
    @Req() req: RequestWithUser,
    @Body() dto: CreateConversationDto,
  ) {
    const userId = req.user.userId;
    return this.chatService.createConversation(userId, dto);
  }

  @Get('conversations')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'List user conversations' })
  @ApiQuery({
    name: 'context',
    enum: ConversationContext,
    required: false,
    description: 'Filter by conversation context',
  })
  @ApiOkResponse({ description: 'List of user conversations.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  getUserConversations(
    @Req() req: RequestWithUser,
    @Query('context') context?: ConversationContext,
  ) {
    const userId = req.user.userId;
    return this.chatService.getUserConversations(userId, context);
  }

  @Post('conversations/:id/participants')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Add participant to group chat' })
  @ApiParam({ name: 'id', type: Number, description: 'Conversation ID' })
  @ApiBody({
    schema: { type: 'object', properties: { userId: { type: 'number' } } },
  })
  @ApiCreatedResponse({ description: 'Participant added successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  addParticipant(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) conversationId: number,
    @Body('userId', ParseIntPipe) userIdToAdd: number,
  ) {
    const userId = req.user.userId;
    return this.chatService.addParticipant(userId, conversationId, userIdToAdd);
  }

  @Delete('conversations/:id/participants/:userId')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Remove participant from group chat' })
  @ApiParam({ name: 'id', type: Number, description: 'Conversation ID' })
  @ApiParam({ name: 'userId', type: Number, description: 'User ID to remove' })
  @ApiOkResponse({ description: 'Participant removed successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({
    status: 404,
    description: 'Conversation or participant not found.',
  })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  removeParticipant(
    @Param('id', ParseIntPipe) conversationId: number,
    @Param('userId', ParseIntPipe) userIdToRemove: number,
  ) {
    return this.chatService.removeParticipant(conversationId, userIdToRemove);
  }

  @Get('conversations/:id/messages')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get messages for a conversation' })
  @ApiParam({ name: 'id', type: Number, description: 'Conversation ID' })
  @ApiOkResponse({ description: 'List of messages.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  getMessages(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) conversationId: number,
    @Query() query: GetMessagesDto,
  ) {
    const userId = req.user.userId;
    return this.chatService.getMessages(userId, conversationId, query);
  }

  @Delete('conversations/:id/history')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Clear chat history for the user' })
  @ApiParam({ name: 'id', type: Number, description: 'Conversation ID' })
  @ApiOkResponse({ description: 'Chat history cleared successfully.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  async clearChat(
    @Param('id', ParseIntPipe) conversationId: number,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.userId;
    await this.chatService.clearChat(userId, conversationId);
    this.chatGateway.server
      .to(`user_${userId}`)
      .emit('chatCleared', { conversationId });
    return { success: true };
  }

  @Patch('conversations/:id/mute')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Mute/Unmute a conversation' })
  @ApiParam({ name: 'id', type: Number, description: 'Conversation ID' })
  @ApiOkResponse({ description: 'Conversation mute status updated.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  async muteConversation(
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() dto: MuteConversationDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.userId;
    return this.chatService.muteConversation(
      userId,
      conversationId,
      dto.isMuted,
    );
  }

  @Patch('messages/:id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Edit a message' })
  @ApiParam({ name: 'id', type: Number, description: 'Message ID' })
  @ApiOkResponse({ description: 'Message updated successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Message not found.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  async updateMessage(
    @Param('id', ParseIntPipe) messageId: number,
    @Body() updateMessageDto: UpdateMessageDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.userId;
    const updatedMessage = await this.chatService.updateMessage(
      userId,
      messageId,
      updateMessageDto,
    );
    this.chatGateway.server
      .to(`conversation_${updatedMessage.conversationId}`)
      .emit('messageUpdated', updatedMessage);
    return updatedMessage;
  }

  @Delete('messages/:id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Delete (unsend) a message' })
  @ApiParam({ name: 'id', type: Number, description: 'Message ID' })
  @ApiOkResponse({ description: 'Message deleted successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Message not found.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  async deleteMessage(
    @Param('id', ParseIntPipe) messageId: number,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.userId;
    const deletedMessage = await this.chatService.deleteMessage(
      userId,
      messageId,
    );
    this.chatGateway.server
      .to(`conversation_${deletedMessage.conversationId}`)
      .emit('messageDeleted', deletedMessage);
    return deletedMessage;
  }

  @Get('search')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Search messages' })
  @ApiQuery({ name: 'q', type: String, description: 'Search query' })
  @ApiOkResponse({ description: 'Search results.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  searchMessages(@Req() req: RequestWithUser, @Query('q') query: string) {
    const userId = req.user.userId;
    return this.chatService.searchMessages(userId, query);
  }

  @Post('attachments')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Upload a file for chat' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadAttachmentDto })
  @ApiCreatedResponse({ description: 'File uploaded successfully.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = `${UPLOADS_DIR_ABSOLUTE}/chat`;
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const randomName = uuidv4Typed();
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    }),
  )
  uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    return this.chatService.createAttachment(file);
  }

  @Get('attachments/:filename')
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @ApiOperation({ summary: 'Get a secure chat attachment' })
  @ApiParam({
    name: 'filename',
    type: String,
    description: 'Filename of the attachment',
  })
  @ApiOkResponse({ description: 'File stream.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User not in conversation.',
  })
  @ApiResponse({ status: 404, description: 'Attachment not found.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  async getAttachment(
    @Param('filename') filename: string,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const userId = req.user.userId;
    const filePath = await this.chatService.getAttachmentPath(userId, filename);
    return res.sendFile(filePath);
  }

  @Post('attachments/download')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Download attachment securely (Bypasses IDM)' })
  @ApiBody({
    schema: { type: 'object', properties: { filename: { type: 'string' } } },
  })
  @ApiResponse({ status: 200, description: 'File download initiated.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User not in conversation.',
  })
  @ApiResponse({ status: 404, description: 'Attachment not found.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  async downloadAttachment(
    @Body('filename') filename: string,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const userId = req.user.userId;
    const filePath = await this.chatService.getAttachmentPath(userId, filename);
    return res.sendFile(filePath);
  }

  @Post('messages/:id/report')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Report a message' })
  @ApiParam({ name: 'id', type: Number, description: 'Message ID' })
  @ApiCreatedResponse({ description: 'Message reported successfully.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  async reportMessage(
    @Param('id', ParseIntPipe) messageId: number,
    @Body() reportMessageDto: ReportMessageDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.userId;
    return this.chatService.reportMessage(
      userId,
      messageId,
      reportMessageDto.reason,
    );
  }

  @Patch('reports/:id')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Update report status (Admin only)' })
  @ApiParam({ name: 'id', type: Number, description: 'Report ID' })
  @ApiOkResponse({ description: 'Report status updated successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Admin only.' })
  @ApiResponse({ status: 404, description: 'Report not found.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  async updateReportStatus(
    @Param('id', ParseIntPipe) reportId: number,
    @Body() dto: UpdateReportStatusDto,
    @Req() req: RequestWithUser,
  ) {
    return this.chatService.updateReportStatus(
      req.user.userId,
      reportId,
      dto.status,
    );
  }
  @Post('broadcast')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Send a broadcast message (Admin only)' })
  @ApiCreatedResponse({ description: 'Broadcast sent successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Admin only.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  async broadcastMessage(
    @Body() broadcastMessageDto: BroadcastMessageDto,
    @Req() req: RequestWithUser,
  ) {
    const payload = await this.chatService.sendBroadcast(
      req.user.userId,
      broadcastMessageDto,
    );

    // Pending implementation for post-MVP: This will be pushed to a queue.
    this.chatGateway.server.emit('broadcastMessage', payload);

    return { success: true, message: 'Broadcast sent' };
  }

  @Get('broadcasts/:id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Get broadcast details (Admin only)' })
  @ApiParam({ name: 'id', type: String, description: 'Broadcast ID' })
  @ApiOkResponse({ description: 'Broadcast details retrieved successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Admin only.' })
  @ApiResponse({ status: 404, description: 'Broadcast not found.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  async getBroadcast(
    @Param('id') broadcastId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.chatService.getBroadcast(req.user.userId, broadcastId);
  }

  @Post('fallback/telegram')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Send message via Telegram fallback' })
  @ApiCreatedResponse({ description: 'Message sent via Telegram.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  sendTelegramFallback(
    @Req() req: RequestWithUser,
    @Body() dto: TelegramFallbackDto,
  ) {
    const userId = req.user.userId;
    return this.chatService.sendTelegramFallback(userId, dto);
  }
}
