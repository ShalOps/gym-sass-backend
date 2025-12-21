import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { DatabaseService } from '../../database/database.service';
import { AI_CONFIG } from '../utils/ai-config.constants';

interface AIConversation {
  id: string;
  userId: string;
  messages: Array<{
    role: string;
    text: string;
    timestamp: string;
    metadata?: any;
  }>;
}

@Injectable()
export class ConversationManagerService {
  private readonly logger = new Logger(ConversationManagerService.name);

  constructor(
    private readonly database: DatabaseService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Fetches conversation from DB and synchronizes it to Redis.
   * @param key The cache key (conversation id or user-specific key)
   * @param userId The user id associated with the conversation
   * @returns The AIConversation object from DB or a default if not found
   */
  private async fetchAndSyncFromDb(
    key: string,
    userId: string,
  ): Promise<AIConversation> {
    const conversation = await this.database.aIConversation.findFirst({
      where: {
        id: key,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (conversation) {
      const state = conversation.state as unknown as AIConversation;
      const ttl = AI_CONFIG.CACHE_CONFIG.CONVERSATION_TTL_MINUTES * 60 * 1000; // Convert minutes to milliseconds
      await this.cacheManager
        .set(key, state, ttl)
        .catch((e: Error) =>
          this.logger.error(`Failed to sync Redis from DB: ${e.message}`),
        );
      return state;
    }

    // Return default conversation if not found in DB
    return { id: key, userId, messages: [] };
  }

  async loadConversation(
    userId: string,
    conversationId?: string,
  ): Promise<AIConversation> {
    const key = conversationId ?? `conv:${userId}`;
    this.logger.debug(`loadConversation key=${key}`);

    // Attempt to retrieve from Redis cache first using the Stale-While-Revalidate strategy
    try {
      const cached = await this.cacheManager.get<AIConversation>(key);
      if (cached) {
        this.logger.debug(
          `Cache hit for ${key}. Returning immediately and revalidating in background.`,
        );

        // Initiate background revalidation: fetch the latest data from the database and update the cache.
        // This operation is non-blocking to ensure a prompt response.
        this.fetchAndSyncFromDb(key, userId).catch((err: Error) =>
          this.logger.error(
            `Background sync failed for ${key}: ${err.message}`,
          ),
        );

        return cached;
      }
    } catch (error) {
      this.logger.error(
        `Redis error in loadConversation: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Cache miss - fetch from DB synchronously
    this.logger.debug(`Cache miss for ${key}, fetching from DB`);
    return this.fetchAndSyncFromDb(key, userId);
  }

  async saveConversation(conv: AIConversation): Promise<AIConversation> {
    this.logger.debug(`saveConversation id=${conv?.id}`);
    if (!conv || !conv.id) throw new Error('Invalid conversation object');

    const ttl = AI_CONFIG.CACHE_CONFIG.CONVERSATION_TTL_MINUTES * 60 * 1000; // Convert minutes to milliseconds
    const expiresAt = new Date(Date.now() + ttl);

    // Save to Redis (Primary)
    await this.cacheManager
      .set(conv.id, conv, ttl)
      .catch((e: Error) => this.logger.error(`Redis save error: ${e.message}`));

    // Save to Database (Fallback/Persistence)
    await this.database.aIConversation.upsert({
      where: { id: conv.id },
      update: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        state: JSON.parse(JSON.stringify(conv)),
        expiresAt,
        updatedAt: new Date().toISOString(),
      },
      create: {
        id: conv.id,
        userId: parseInt(conv.userId),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        state: JSON.parse(JSON.stringify(conv)),
        expiresAt,
      },
    });

    return conv;
  }
}
