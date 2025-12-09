import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
  HttpException,
  InternalServerErrorException,
  HttpStatus,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { BroadcastMessageDto } from './dto/broadcast-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import {
  ConversationContext,
  AttachmentType,
  Message,
  ReportStatus,
  Role,
} from '@prisma/client';
import { UpdateMessageDto } from './dto/update-message.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { TelegramFallbackDto } from './dto/telegram-fallback.dto';
import { ChatPermissionService } from './chat-permission.service';
import { EncryptionService } from '../utils/encryption/encryption.service';
import { CompressionService } from '../utils/compression/compression.service';
import { join } from 'path';
import { UPLOADS_DIR_ABSOLUTE } from '../config/paths.config';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly chatPermissionService: ChatPermissionService,
    private readonly encryptionService: EncryptionService,
    private readonly compressionService: CompressionService,
  ) {}

  /**
   * Sanitizes and logs chat-related errors, ensuring sensitive details are not exposed to clients.
   * Converts unknown errors into a safe `InternalServerErrorException` unless the error is already an `HttpException`.
   * Logs warnings for anticipated HTTP exceptions and errors for unexpected failures.
   * @param error The error object thrown during chat operations
   * @returns An `HttpException` suitable for returning to the client
   */
  private sanitizeChatError(error: unknown): HttpException {
    const errorMessage =
      error &&
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : String(error);

    // Internally log the raw error details for diagnostic purposes.
    // Log the stack trace only if the error is not an anticipated HttpException (e.g., ForbiddenException, NotFoundException).
    if (error instanceof HttpException) {
      this.logger.warn(`Chat operation denied: ${errorMessage}`);
    } else {
      this.logger.error(`Chat operation failed: ${errorMessage}`, error);
    }

    if (error instanceof HttpException) {
      return error;
    }

    // Handle specific Prisma errors if needed (e.g. Unique constraint)
    // if (errorMessage.includes('Unique constraint failed')) ...

    // Default safe error message - hide internal details
    return new InternalServerErrorException(
      'An unexpected error occurred while processing your chat request. Please try again later.',
    );
  }

  /**
   * Sanitizes a search query string to prevent security vulnerabilities and ensure safe processing.
   * @param query - The search query string to sanitize.
   * @returns The sanitized query string, or `null` if the input is invalid or empty after sanitization.
   */
  private sanitizeSearchQuery(query: string): string | null {
    if (!query || typeof query !== 'string') {
      return null;
    }

    let sanitized = query.trim();

    if (sanitized.length < 1) {
      return null;
    }

    // Check maximum length (prevent DoS with extremely long queries)
    const MAX_SEARCH_LENGTH = 100;
    if (sanitized.length > MAX_SEARCH_LENGTH) {
      sanitized = sanitized.substring(0, MAX_SEARCH_LENGTH);
    }

    // Remove potentially dangerous characters (null bytes, control chars)
    sanitized = sanitized.replace(/\0/g, '').replace(/[\r\n\t]/g, ' ');

    sanitized = sanitized.replace(/\s+/g, ' ');

    // Basic XSS prevention (remove script tags and common XSS vectors)
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '');

    sanitized = sanitized.trim();

    if (sanitized.length < 1) {
      return null;
    }

    return sanitized;
  }

  /**
   * Validates file MIME type against allowed types and determines attachment type
   * @param mimeType The MIME type of the uploaded file
   * @returns The determined AttachmentType
   * @throws BadRequestException if MIME type is not allowed
   */
  private validateAndDetermineAttachmentType(mimeType: string): AttachmentType {
    const allowedTypes = {
      [AttachmentType.IMAGE]: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
      ],
      [AttachmentType.VIDEO]: [
        'video/mp4',
        'video/webm',
        'video/avi',
        'video/quicktime', // .mov files
        'video/x-matroska', // .mkv files
      ],
      [AttachmentType.AUDIO]: [
        'audio/mpeg', // .mp3
        'audio/wav',
        'audio/ogg',
        'audio/mp4', // .m4a
        'audio/aac',
      ],
      [AttachmentType.FILE]: [
        'application/pdf',
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'text/plain',
        'application/zip',
        'application/x-zip-compressed',
        'application/vnd.ms-excel', // .xls
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-powerpoint', // .ppt
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      ],
    };

    // Check if the MIME type is in any of the allowed categories
    for (const [attachmentType, mimeTypes] of Object.entries(allowedTypes)) {
      if (mimeTypes.includes(mimeType)) {
        return attachmentType as AttachmentType;
      }
    }

    // If MIME type is not allowed, throw an error
    throw new BadRequestException(
      `File type not allowed. Supported formats: Images (jpg, png, gif, webp), Videos (mp4, webm, avi, mov, mkv), Audio (mp3, wav, ogg, m4a, aac), Documents (pdf, doc, docx, txt, xls, xlsx, ppt, pptx, zip)`,
    );
  }

  /**
   * Processes an incoming message by attempting to decrypt, decode, and decompress it.
   * If any step fails, returns the original content (useful for legacy or plain text messages).
   *
   * @param content - The message content to process, which may be encrypted and compressed.
   * @returns The processed message as a string, or `null` if the input is empty or invalid.
   */
  private processIncomingMessage(
    content: string | null | undefined,
  ): string | null {
    if (!content) return null;
    try {
      // Decrypt
      const decrypted = this.encryptionService.decrypt(content);
      // Decode from Base64
      const compressed = Buffer.from(decrypted, 'base64');
      // Decompress
      return this.compressionService.decompress(compressed);
    } catch {
      // Return original if processing fails (e.g. old unencrypted messages or plain text)
      return content;
    }
  }

  /**
   * Processes an outgoing message by compressing, encoding, and encrypting its content.
   * Returns the encrypted string, or the original content if processing fails.
   *
   * @param content - The message content to process.
   * @returns The processed (encrypted) message, or the original content if an error occurs.
   */
  private processOutgoingMessage(
    content: string | null | undefined,
  ): string | null {
    if (!content) return null;
    try {
      // Compress
      const compressed = this.compressionService.compress(content);
      // Encode to Base64 to be encryptable
      const compressedBase64 = compressed.toString('base64');
      // Encrypt
      return this.encryptionService.encrypt(compressedBase64);
    } catch {
      // Return original if processing fails
      return content;
    }
  }

  async getMessages(
    userId: number,
    conversationId: number,
    dto: GetMessagesDto,
  ) {
    try {
      const { cursor, limit = 50 } = dto;

      // Verify User is Participant & Get visibleFrom
      const participant = await this.db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      });

      if (!participant) {
        throw new ForbiddenException(
          'You are not a participant of this conversation',
        );
      }

      // Fetch Messages
      const messages = await this.db.message.findMany({
        where: {
          conversationId,
          createdAt: {
            gt: participant.visibleFrom, // Only show messages after "Clear Chat"
          },
        },
        take: limit,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          sender: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              profilePic: true,
            },
          },
          attachments: true,
          replyTo: {
            select: {
              id: true,
              content: true,
              sender: {
                select: { firstName: true },
              },
            },
          },
        },
      });

      // Fetch participants to calculate read status
      const participants = await this.db.conversationParticipant.findMany({
        where: { conversationId },
        select: { userId: true, lastReadAt: true },
      });

      // Decrypt content and calculate readAt
      const decryptedMessages = messages.map((msg) => {
        // Calculate readAt
        const recipients = participants.filter(
          (p) => p.userId !== msg.senderId,
        );
        let readAt: Date | null = null;

        if (recipients.length > 0) {
          const allRead = recipients.every(
            (p) => p.lastReadAt >= msg.createdAt,
          );
          if (allRead) {
            readAt = recipients.reduce(
              (max, p) => (p.lastReadAt > max ? p.lastReadAt : max),
              new Date(0),
            );
          }
        }

        return {
          ...msg,
          content: this.processIncomingMessage(msg.content),
          readAt,
          replyTo: msg.replyTo
            ? {
                ...msg.replyTo,
                content: this.processIncomingMessage(msg.replyTo.content),
              }
            : null,
        };
      });

      return decryptedMessages.reverse(); // Return in chronological order for UI
    } catch (error) {
      throw this.sanitizeChatError(error);
    }
  }

  async sendMessage(userId: number, dto: SendMessageDto) {
    try {
      const { conversationId, content, attachmentIds, replyToId, tempId } = dto;

      // Verify User is Participant
      const participant = await this.db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      });

      if (!participant) {
        throw new ForbiddenException(
          'You are not a participant of this conversation',
        );
      }

      // Check Idempotency
      const existingMessage = await this.db.message.findUnique({
        where: { clientSideId: tempId },
        include: { sender: true, attachments: true },
      });

      if (existingMessage) {
        return { message: existingMessage, recipients: [] };
      }

      // Create Message
      const message = await this.db.$transaction(async (tx) => {
        const msg = await tx.message.create({
          data: {
            conversationId,
            senderId: userId,
            content: this.processOutgoingMessage(content),
            clientSideId: tempId,
            replyToId,
            attachments: attachmentIds?.length
              ? {
                  connect: attachmentIds.map((id) => ({ id })),
                }
              : undefined,
          },
          include: {
            sender: {
              select: {
                userId: true,
                firstName: true,
                lastName: true,
                profilePic: true,
              },
            },
            attachments: true,
            replyTo: {
              select: {
                id: true,
                content: true,
                sender: {
                  select: { firstName: true },
                },
              },
            },
          },
        });

        // Update Conversation Last Message
        await tx.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: new Date() },
        });

        return msg;
      });

      // Decrypt message for response and notification
      const decryptedMessage = {
        ...message,
        content: this.processIncomingMessage(message.content),
        readAt: null,
        replyTo: message.replyTo
          ? {
              ...message.replyTo,
              content: this.processIncomingMessage(message.replyTo.content),
            }
          : null,
      };

      // Notify other participants
      const otherParticipants = await this.db.conversationParticipant.findMany({
        where: {
          conversationId,
          userId: { not: userId },
        },
        select: { userId: true, isMuted: true },
      });

      for (const p of otherParticipants) {
        if (!p.isMuted) {
          await this.notifyRecipient(
            p.userId,
            decryptedMessage as unknown as Message,
          );
        }
      }

      return {
        message: decryptedMessage,
        recipients: otherParticipants.map((p) => p.userId),
      };
    } catch (error) {
      throw this.sanitizeChatError(error);
    }
  }

  async sendTelegramFallback(userId: number, dto: TelegramFallbackDto) {
    try {
      const participant = await this.db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: dto.conversationId,
            userId,
          },
        },
      });

      if (!participant) {
        throw new ForbiddenException(
          'You are not a participant of this conversation',
        );
      }

      const otherParticipants = await this.db.conversationParticipant.findMany({
        where: {
          conversationId: dto.conversationId,
          userId: { not: userId },
        },
      });

      for (const p of otherParticipants) {
        await this.notificationsService.notifyUser(
          p.userId,
          `[Telegram Fallback] ${dto.content}`,
        );
      }

      return { success: true, message: 'Fallback message sent' };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Telegram')) {
        throw new HttpException('FALLBACK_FAILED', HttpStatus.BAD_GATEWAY);
      }
      throw this.sanitizeChatError(error);
    }
  }

  async searchMessages(userId: number, query: string) {
    try {
      // Sanitize and validate search query
      const sanitizedQuery = this.sanitizeSearchQuery(query);
      if (!sanitizedQuery) {
        return []; // Return empty results for invalid/empty queries
      }

      // Get user's conversations
      const userConversations = await this.db.conversationParticipant.findMany({
        where: { userId },
        select: { conversationId: true },
      });
      const conversationIds = userConversations.map((c) => c.conversationId);

      // Fetch recent messages from these conversations
      const messages = await this.db.message.findMany({
        where: {
          conversationId: { in: conversationIds },
          deletedAt: null,
        },
        include: {
          sender: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              profilePic: true,
            },
          },
          conversation: {
            select: {
              id: true,
              title: true,
              isGroup: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 200, // Limit to last 200 messages to prevent performance issues
      });

      // Decrypt and Filter with sanitized query
      const results = messages
        .map((msg) => {
          const decrypted = this.processIncomingMessage(msg.content);
          return { ...msg, content: decrypted };
        })
        .filter((msg) => {
          if (!msg.content) return false;
          // Use sanitized query for case-insensitive search
          const content = msg.content.toLowerCase();
          const searchTerm = sanitizedQuery.toLowerCase();
          return content.includes(searchTerm);
        });

      return results;
    } catch (error) {
      throw this.sanitizeChatError(error);
    }
  }

  async markAsRead(userId: number, conversationId: number) {
    // Verify User is Participant
    const participant = await this.db.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }

    // Update lastReadAt
    await this.db.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    return { status: 'ok', conversationId, userId, readAt: new Date() };
  }

  async notifyRecipient(userId: number, message: Message) {
    const contentPreview = message.content || '[Attachment]';
    await this.notificationsService.notifyUser(
      userId,
      `New message: ${contentPreview}`,
    );
  }

  async updateMessage(
    userId: number,
    messageId: number,
    dto: UpdateMessageDto,
  ) {
    const message = await this.db.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    const updatedMessage = await this.db.message.update({
      where: { id: messageId },
      data: {
        content: this.processOutgoingMessage(dto.content),
        isEdited: true,
        attachments: dto.attachmentIds
          ? {
              set: [], // Remove existing associations
              connect: dto.attachmentIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        sender: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            profilePic: true,
          },
        },
        attachments: true,
        replyTo: {
          include: {
            sender: {
              select: {
                userId: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return {
      ...updatedMessage,
      content: this.processIncomingMessage(updatedMessage.content),
    };
  }

  async deleteMessage(userId: number, messageId: number) {
    const message = await this.db.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    return this.db.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        content: null,
      },
    });
  }

  async createAttachment(file: Express.Multer.File) {
    // Validate and determine attachment type with specific MIME type checking
    const type = this.validateAndDetermineAttachmentType(file.mimetype);

    // Store filename for secure proxy resolution (/chat/attachments/:filename)
    const attachment = await this.db.messageAttachment.create({
      data: {
        url: file.filename, // We store just the filename for the proxy to resolve
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        type,
      },
    });

    return attachment;
  }

  async getAttachmentPath(userId: number, filename: string): Promise<string> {
    try {
      // Find attachment by filename (GET endpoint uses :filename parameter)
      const attachment = await this.db.messageAttachment.findFirst({
        where: {
          url: { endsWith: filename },
        },
        include: {
          message: {
            include: {
              conversation: {
                include: {
                  participants: true,
                },
              },
            },
          },
        },
      });

      if (!attachment) {
        throw new NotFoundException('Attachment not found');
      }

      // Check if the user is a participant of the conversation
      const isParticipant =
        attachment.message &&
        attachment.message.conversation &&
        attachment.message.conversation.participants &&
        attachment.message.conversation.participants.some(
          (p) => p.userId === userId,
        );

      if (!isParticipant) {
        // Check if user is Admin
        const user = await this.db.user.findUnique({ where: { userId } });
        if (user?.role !== 'ADMIN') {
          throw new ForbiddenException(
            'You do not have permission to view this attachment',
          );
        }
      }

      // Return the absolute path
      return join(UPLOADS_DIR_ABSOLUTE, 'chat', filename);
    } catch (error) {
      throw this.sanitizeChatError(error);
    }
  }

  async getUserConversations(userId: number, context?: ConversationContext) {
    try {
      const conversations = await this.db.conversation.findMany({
        where: {
          participants: {
            some: {
              userId,
            },
          },
          context: context || undefined,
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  userId: true,
                  firstName: true,
                  lastName: true,
                  profilePic: true,
                },
              },
            },
          },
          messages: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
        orderBy: {
          lastMessageAt: 'desc',
        },
      });

      // Calculate unread counts and decrypt last message
      const conversationsWithUnread = await Promise.all(
        conversations.map(async (conv) => {
          const userParticipant = conv.participants.find(
            (p) => p.userId === userId,
          );

          let unreadCount = 0;
          if (userParticipant) {
            unreadCount = await this.db.message.count({
              where: {
                conversationId: conv.id,
                createdAt: {
                  gt: userParticipant.lastReadAt,
                },
                senderId: {
                  not: userId, // Don't count own messages
                },
              },
            });
          }

          // Decrypt last message content
          if (conv.messages[0]) {
            conv.messages[0].content = this.processIncomingMessage(
              conv.messages[0].content,
            );
          }

          return {
            ...conv,
            unreadCount,
          };
        }),
      );

      return conversationsWithUnread;
    } catch (error) {
      throw this.sanitizeChatError(error);
    }
  }

  async createConversation(userId: number, dto: CreateConversationDto) {
    try {
      const { participantIds, context, contextId, title } = dto;

      // Check if the creator is allowed to chat with each participant
      for (const participantId of participantIds) {
        await this.chatPermissionService.validateConversationStart(
          userId,
          participantId,
        );
      }

      // Ensure the creator is in the participant list
      const allParticipantIds = Array.from(
        new Set([...participantIds, userId]),
      );

      if (allParticipantIds.length < 2) {
        throw new BadRequestException(
          'A conversation must have at least 2 participants',
        );
      }

      const isGroup = allParticipantIds.length > 2;

      // Contextual Conversation (e.g. Order Support) - Unique by Context
      if (context && context !== ConversationContext.GENERAL && contextId) {
        // Contextual Ownership Validation
        if (context === ConversationContext.CLASS_INQUIRY) {
          const classId = parseInt(contextId);
          if (isNaN(classId)) {
            throw new BadRequestException('Invalid Class ID for context');
          }
          const gymClass = await this.db.gymClasses.findUnique({
            where: { classId },
          });
          if (!gymClass) {
            throw new NotFoundException('Class context not found');
          }
        } else if (context === ConversationContext.SERVICE_BOOKING) {
          const bookingId = parseInt(contextId);
          if (isNaN(bookingId)) {
            throw new BadRequestException('Invalid Booking ID for context');
          }
          const booking = await this.db.serviceBooking.findUnique({
            where: { serviceBookingId: bookingId },
            include: {
              service: {
                include: {
                  gym: true,
                },
              },
            },
          });

          if (!booking) {
            throw new NotFoundException('Booking context not found');
          }

          // User must be the booker OR the gym owner OR an Admin
          const isBooker = booking.userId === userId;
          const isGymOwner = booking.service.gym.gymOwnerId === userId;

          if (!isBooker && !isGymOwner) {
            const user = await this.db.user.findUnique({ where: { userId } });
            if (user?.role !== 'ADMIN') {
              throw new ForbiddenException(
                'You do not have permission to discuss this booking',
              );
            }
          }
        } else if (context === ConversationContext.ADMIN_ANNOUNCEMENT) {
          const user = await this.db.user.findUnique({ where: { userId } });
          if (user?.role !== 'ADMIN') {
            throw new ForbiddenException(
              'Only Admins can create announcement conversations',
            );
          }
        }
        // Note: PRODUCT_INQUIRY and ORDER_SUPPORT validation skipped as Product/Order models are not yet available.

        const existing = await this.db.conversation.findFirst({
          where: {
            context,
            contextId,
          },
          include: { participants: true },
        });

        if (existing) {
          // For SASS platform focused on 1-on-1 conversations, create separate
          // conversations per user per context to maintain privacy and clear separation
          // Don't return existing conversation - let it fall through to create new one
          // return existing; // Commented out: Future option to return existing contextual conversations
        }
      }

      // 1-on-1 General Conversation - Unique by Participants
      if (!isGroup && (!context || context === ConversationContext.GENERAL)) {
        // Find conversation with exactly the same 2 participants (1-on-1 only)
        const existing = await this.db.conversation.findFirst({
          where: {
            isGroup: false,
            context: ConversationContext.GENERAL,
            participants: {
              every: {
                userId: { in: allParticipantIds },
              },
            },
          },
          include: {
            participants: {
              select: { userId: true },
            },
          },
        });

        // Verify exact participant match (exactly 2 participants, both in our list)
        if (existing && existing.participants.length === 2) {
          return existing;
        }
      }

      // Create New Conversation
      return await this.db.conversation.create({
        data: {
          isGroup,
          title,
          context: context || ConversationContext.GENERAL,
          contextId,
          participants: {
            create: allParticipantIds.map((id) => ({
              userId: id,
            })),
          },
        },
        include: {
          participants: true,
        },
      });
    } catch (error) {
      throw this.sanitizeChatError(error);
    }
  }

  async clearChat(userId: number, conversationId: number) {
    const participant = await this.db.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    return this.db.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        visibleFrom: new Date(),
      },
    });
  }

  async muteConversation(
    userId: number,
    conversationId: number,
    isMuted: boolean,
  ) {
    const participant = await this.db.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    return this.db.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        isMuted,
      },
    });
  }

  async addParticipant(
    requestingUserId: number,
    conversationId: number,
    userId: number,
  ) {
    try {
      const conversation = await this.db.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      if (!conversation.isGroup) {
        throw new BadRequestException(
          'Cannot add participants to a 1-on-1 chat',
        );
      }

      // Check if requesting user is a participant
      const requester = await this.db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId: requestingUserId,
          },
        },
      });

      if (!requester) {
        throw new ForbiddenException(
          'You are not a participant of this conversation',
        );
      }

      await this.chatPermissionService.validateConversationStart(
        requestingUserId,
        userId,
      );

      // Check if already participant
      const existing = await this.db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      });

      if (existing) {
        return existing;
      }

      return await this.db.conversationParticipant.create({
        data: {
          conversationId,
          userId,
        },
      });
    } catch (error) {
      throw this.sanitizeChatError(error);
    }
  }

  async removeParticipant(conversationId: number, userId: number) {
    const conversation = await this.db.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!conversation.isGroup) {
      throw new BadRequestException(
        'Cannot remove participants from a 1-on-1 chat',
      );
    }

    return this.db.conversationParticipant.delete({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });
  }

  async reportMessage(userId: number, messageId: number, reason: string) {
    const message = await this.db.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return this.db.chatReport.create({
      data: {
        messageId,
        reporterId: userId,
        reason,
      },
    });
  }

  async updateReportStatus(
    userId: number,
    reportId: number,
    status: ReportStatus,
  ) {
    const user = await this.db.user.findUnique({ where: { userId } });
    if (user?.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can update report status');
    }

    const report = await this.db.chatReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return this.db.chatReport.update({
      where: { id: reportId },
      data: { status },
    });
  }

  async sendBroadcast(userId: number, dto: BroadcastMessageDto) {
    const user = await this.db.user.findUnique({ where: { userId } });
    if (user?.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can send broadcasts');
    }

    if (!dto.targetRole) {
      throw new BadRequestException('targetRole is required for broadcasts');
    }

    // Create broadcast record in database
    const broadcast = await this.db.broadcastMessage.create({
      data: {
        content: dto.content,
        targetRole: dto.targetRole,
        senderId: userId,
        status: 'PROCESSING',
        scheduledAt: new Date(),
      },
    });

    // Send immediate response to client
    const response = {
      broadcastId: broadcast.id,
      content: dto.content,
      targetRole: dto.targetRole,
      status: 'PROCESSING',
      createdAt: broadcast.createdAt,
    };

    // Process notifications asynchronously (hybrid approach; not queued)
    setImmediate(() => {
      void this.processBroadcastNotifications(
        broadcast.id,
        dto.targetRole,
        dto.content,
      );
    });

    return response;
  }

  private async processBroadcastNotifications(
    broadcastId: string,
    targetRole: Role,
    content: string,
  ): Promise<void> {
    try {
      // Get all users with the target role
      const targetUsers = await this.db.user.findMany({
        where: { role: targetRole },
        select: { userId: true },
      });

      // Send notifications to all users
      const notificationPromises = targetUsers.map((user) =>
        this.notificationsService
          .notifyUser(user.userId, `Broadcast: ${content}`)
          .catch((error) => {
            // Log error but don't fail the entire broadcast
            this.logger.error(`Failed to notify user ${user.userId}:`, error);
            return null;
          }),
      );

      // Wait for all notifications to complete
      await Promise.allSettled(notificationPromises);

      await this.db.broadcastMessage.update({
        where: { id: broadcastId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    } catch (error) {
      await this.db.broadcastMessage.update({
        where: { id: broadcastId },
        data: { status: 'FAILED' },
      });
      this.logger.error(`Broadcast ${broadcastId} failed:`, error);
    }
  }

  async getBroadcast(adminId: number, broadcastId: string) {
    const admin = await this.db.user.findUnique({
      where: { userId: adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can view broadcast details');
    }

    const broadcast = await this.db.broadcastMessage.findUnique({
      where: { id: broadcastId },
      include: {
        sender: {
          select: {
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!broadcast) {
      throw new NotFoundException('Broadcast not found');
    }

    // Verify admin owns this broadcast
    if (broadcast.senderId !== adminId) {
      throw new ForbiddenException('You can only view your own broadcasts');
    }

    return broadcast;
  }
}
