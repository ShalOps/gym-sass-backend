import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket, Namespace } from 'socket.io';
import {
  UseGuards,
  Logger,
  UsePipes,
  ValidationPipe,
  UseFilters,
} from '@nestjs/common';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { WsExceptionFilter } from './filters/ws-exception.filter';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { TypingDto } from './dto/typing.dto';
import { DeliveryReceiptDto } from './dto/delivery-receipt.dto';
import { WsThrottlerGuard } from './guards/ws-throttler.guard';
import { Throttle } from '@nestjs/throttler';
import { Message } from '@prisma/client';
import { getWebSocketCorsConfig } from '../config/cors.config';
import type {
  AuthenticatedSocket,
  AuthenticatedUser,
} from './types/authenticated-socket.type';

@WebSocketGateway({
  namespace: 'chat',
  cors: getWebSocketCorsConfig(),
})
@UseFilters(new WsExceptionFilter())
@UseGuards(WsThrottlerGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private onlineUsers = new Map<number, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly chatService: ChatService,
    private readonly db: DatabaseService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Client ${client.id} has no token. Disconnecting...`);
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        role: string;
        email?: string;
        userId?: number;
      }>(token, { secret });

      // Map JWT payload (sub) to AuthenticatedUser (userId)
      const user = {
        userId: payload.sub || payload.userId,
        role: payload.role,
        email: payload.email,
      } as AuthenticatedUser;

      const dbUser = await this.db.user.findUnique({
        where: { userId: user.userId },
        select: { firstName: true, lastName: true, email: true },
      });

      // Retrieve the most up-to-date user information from the database if not present in the token
      if (dbUser) {
        user.firstName = dbUser.firstName;
        user.lastName = dbUser.lastName;
        user.email = dbUser.email;
      }

      client.data.user = user;
      this.logger.log(`Client connected: ${client.id} (User: ${user.userId})`);

      const wasOnline = this.onlineUsers.has(user.userId);
      if (!wasOnline) {
        this.onlineUsers.set(user.userId, new Set());
      }
      this.onlineUsers.get(user.userId)?.add(client.id);

      if (!wasOnline) {
        this.broadcastOnlineUsers();
      }

      // Join user to their own room for direct messages/notifications
      await client.join(`user_${user.userId}`);
    } catch (err) {
      const error = err as Error;
      this.logger.warn(`Connection unauthorized: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const authClient = client as AuthenticatedSocket;
    const user = authClient.data?.user;

    if (user?.userId) {
      const sockets = this.onlineUsers.get(user.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.onlineUsers.delete(user.userId);
          this.broadcastOnlineUsers();
        }
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private broadcastOnlineUsers() {
    const users = Array.from(this.onlineUsers.keys());
    this.server.emit('online_users', users);
  }

  @SubscribeMessage('getOnlineStatus')
  handleGetOnlineStatus(@MessageBody() userIds: number[]) {
    if (!Array.isArray(userIds)) return {};
    const status: Record<number, boolean> = {};
    userIds.forEach((id) => {
      status[id] = this.onlineUsers.has(id);
    });
    return status;
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    return { event: 'pong', data: { userId: client.data.user.userId } };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: Record<string, any>,
  ) {
    const conversationId = data?.conversationId as number;
    const userId = client.data.user.userId;

    this.logger.log(
      `Client ${client.id} request to join room. Data: ${JSON.stringify(data)}`,
    );

    if (!conversationId) {
      this.logger.warn(
        `Client ${client.id} failed to join room: No ID provided`,
      );
      return;
    }

    // Validate user has access to this conversation
    await this.chatService.validateConversationAccess(userId, conversationId);

    const roomName = `conversation_${conversationId}`;
    await client.join(roomName);
    this.logger.log(`Client ${client.id} joined room: ${roomName}`);
    return { event: 'joinedRoom', data: { conversationId } };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody('conversationId') conversationId: number,
  ) {
    await client.leave(`conversation_${conversationId}`);
    return { event: 'leftRoom', data: { conversationId } };
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe())
  @Throttle({ default: { limit: 10, ttl: 1000 } })
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const userId = client.data.user.userId;
    const roomName = `conversation_${dto.conversationId}`;

    const adapter = (this.server as unknown as Namespace).adapter;
    const roomSize = adapter.rooms.get(roomName)?.size || 0;
    this.logger.log(
      `User ${userId} sending message to room ${roomName} (Size: ${roomSize}): ${dto.content}`,
    );
    try {
      const result = (await this.chatService.sendMessage(userId, dto)) as {
        message: Message;
        recipients: number[];
      };

      // Emit to conversation room (excluding sender)
      client.to(roomName).emit('newMessage', result.message);

      // Also emit to each recipient's personal room for notifications
      result.recipients.forEach((recipientId) => {
        this.server.to(`user_${recipientId}`).emit('newMessageNotification', {
          conversationId: dto.conversationId,
          senderName:
            `${client.data.user.firstName || ''} ${client.data.user.lastName || ''}`.trim() ||
            'Unknown User',
          content: dto.content,
        });
      });

      return { status: 'ok', data: result.message };
    } catch (error) {
      const err = error as Error;
      throw new WsException(err.message);
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe())
  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: MarkReadDto,
  ) {
    const userId = client.data.user.userId;
    try {
      const result = await this.chatService.markAsRead(
        userId,
        dto.conversationId,
      );

      client.to(`conversation_${dto.conversationId}`).emit('messageRead', {
        conversationId: dto.conversationId,
        userId,
        messageId: dto.messageId,
        readAt: result.readAt,
      });

      return { status: 'ok' };
    } catch (error) {
      const err = error as Error;
      throw new WsException(err.message);
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe())
  @Throttle({ default: { limit: 20, ttl: 1000 } })
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: TypingDto,
  ) {
    const userId = client.data.user.userId;

    // Broadcast to room (excluding sender)
    client.to(`conversation_${dto.conversationId}`).emit('userTyping', {
      conversationId: dto.conversationId,
      userId,
      isTyping: dto.isTyping,
    });
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe())
  @SubscribeMessage('delivery_receipt')
  handleDeliveryReceipt(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: DeliveryReceiptDto,
  ) {
    const userId = client.data.user.userId;

    // Broadcast delivery confirmation to conversation room for all participants
    client.to(`conversation_${dto.conversationId}`).emit('messageDelivered', {
      conversationId: dto.conversationId,
      messageId: dto.messageId,
      deliveredToUserId: userId,
      deliveredAt: new Date(),
    });
  }

  private extractToken(client: Socket): string | undefined {
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token as string;
    }
    const authHeader = client.handshake.headers.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer') {
        return token;
      }
    }
    // Fallback for clients that send token in query (only in development/testing - less secure)
    // // Strictly For Testing Only: This is less secure than auth/headers as query params; can be logged.
    const enableQueryAuth =
      this.configService.get<string>('ENABLE_QUERY_AUTH') === 'true';

    if (enableQueryAuth && client.handshake.query?.token) {
      return client.handshake.query.token as string;
    }
    return undefined;
  }
}
