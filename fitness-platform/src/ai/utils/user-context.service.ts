import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { DatabaseService } from '../../database/database.service';
import { AI_CONFIG } from './ai-config.constants';

export interface UserContext {
  userId: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  location?: string;
  fitnessLevel?: string;
  goals?: string[];
  preferredTimes?: string[];
  preferredLocations?: string[];
  classTypes?: string[];
  priceRange?: { min?: number; max?: number };
  equipmentAtHome?: string[];
  preferences?: Record<string, any>;
  injuries?: string[];
  healthNotes?: string;
  height?: number;
  weight?: number;
  instructors?: number[];
  lastActiveAt?: Date;
  // Recent activity
  recentBookings: Array<{
    classId: number;
    className: string;
    sessionRating?: number;
    attended?: boolean;
    bookedAt: Date;
  }>;
  recentViews: Array<{
    entityType: string;
    entityId: number;
    timestamp: Date;
  }>;
  recentFeedback: Array<{
    feature: string;
    rating?: number;
    comment?: string;
    timestamp: Date;
  }>;
  recentSearches: Array<{
    query: string;
    timestamp: Date;
  }>;
  // Metrics
  latestMetrics?: {
    height?: number;
    weight?: number;
    bmi?: number;
    date: Date;
  };
}

@Injectable()
export class UserContextService {
  private readonly logger = new Logger(UserContextService.name);
  private readonly CACHE_TTL =
    AI_CONFIG.CACHE_CONFIG.USER_CONTEXT_TTL_MINUTES * 60 * 1000; // Convert minutes to milliseconds

  constructor(
    private readonly database: DatabaseService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Gets cached user context, fetching from DB if not cached or expired
   */
  async getUserContext(userId: string | number): Promise<UserContext | null> {
    const cacheKey = `user_context:${userId}`;
    this.logger.debug(`Getting user context for userId=${userId}`);

    try {
      // Try cache first
      const cached = await this.cacheManager.get<UserContext>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for user context ${userId}`);
        return cached;
      }
    } catch (error) {
      this.logger.warn(
        `Cache read error for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Cache miss - fetch from DB
    this.logger.debug(
      `Cache miss for user context ${userId}, fetching from DB`,
    );
    const userContext = await this.fetchUserContextFromDb(userId);

    if (userContext) {
      // Cache the result
      try {
        await this.cacheManager.set(cacheKey, userContext, this.CACHE_TTL);
        this.logger.debug(`Cached user context for ${userId}`);
      } catch (error) {
        this.logger.warn(
          `Cache write error for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return userContext;
  }

  /**
   * Invalidates user context cache (call when user data changes)
   */
  async invalidateUserContext(userId: string | number): Promise<void> {
    const cacheKey = `user_context:${userId}`;
    try {
      await this.cacheManager.del(cacheKey);
      this.logger.debug(`Invalidated cache for user context ${userId}`);
    } catch (error) {
      this.logger.warn(
        `Cache invalidation error for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Fetches comprehensive user context from database
   */
  private async fetchUserContextFromDb(
    userId: string | number,
  ): Promise<UserContext | null> {
    const numericUserId =
      typeof userId === 'string' ? parseInt(userId) : userId;
    if (isNaN(numericUserId)) {
      this.logger.warn(`Invalid userId: ${userId}`);
      return null;
    }

    try {
      const user = await this.database.user.findUnique({
        where: { userId: numericUserId },
        include: {
          ClassBooking: {
            take: AI_CONFIG.DATABASE_LIMITS.USER_BOOKINGS,
            orderBy: { bookedAt: 'desc' },
            include: { class: true },
          },
          userMetrics: {
            take: AI_CONFIG.DATABASE_LIMITS.USER_REVIEWS,
            orderBy: { date: 'desc' },
          },
          viewHistories: {
            take: AI_CONFIG.DATABASE_LIMITS.USER_FEEDBACK,
            orderBy: { timestamp: 'desc' },
          },
          aifeedbacks: {
            take: AI_CONFIG.DATABASE_LIMITS.USER_FEEDBACK,
            orderBy: { timestamp: 'desc' },
          },
          searchQueries: {
            take: AI_CONFIG.DATABASE_LIMITS.USER_SEARCHES,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!user) {
        this.logger.warn(`User not found: ${numericUserId}`);
        return null;
      }

      // Calculate BMI if height and weight available
      let bmi: number | undefined;
      if (user.userMetrics && user.userMetrics.length > 0) {
        const metrics = user.userMetrics[0];
        if (metrics.height && metrics.weight) {
          bmi = metrics.weight / (metrics.height / 100) ** 2;
        }
      } else if (user.height && user.weight) {
        bmi = user.weight / (user.height / 100) ** 2;
      }

      const userContext: UserContext = {
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        location: user.location,
        fitnessLevel: user.fitnessLevel ?? undefined,
        goals: Array.isArray(user.goals) ? user.goals : [],
        preferredTimes: Array.isArray(user.preferredTimes)
          ? user.preferredTimes
          : [],
        preferredLocations: Array.isArray(user.preferredLocations)
          ? user.preferredLocations
          : [],
        classTypes: Array.isArray(user.classTypes) ? user.classTypes : [],
        priceRange: user.priceRange as
          | { min?: number; max?: number }
          | undefined,
        equipmentAtHome: Array.isArray(user.equipmentAtHome)
          ? user.equipmentAtHome
          : [],
        preferences: user.preferences as Record<string, any> | undefined,
        injuries: Array.isArray(user.injuries) ? user.injuries : [],
        healthNotes: user.healthNotes ?? undefined,
        height: user.height ?? undefined,
        weight: user.weight ?? undefined,
        instructors: Array.isArray(user.instructors) ? user.instructors : [],
        lastActiveAt: user.lastActiveAt ?? undefined,
        recentBookings: (user.ClassBooking || []).map((booking) => ({
          classId: booking.class?.classId || 0,
          className: booking.class?.className || '',
          sessionRating:
            booking.sessionRating === null ? undefined : booking.sessionRating,
          attended: booking.attended === null ? undefined : booking.attended,
          bookedAt: booking.bookedAt,
        })),
        recentViews: (user.viewHistories || []).map((view) => ({
          entityType: view.entityType,
          entityId: view.entityId,
          timestamp: view.timestamp,
        })),
        recentFeedback: (user.aifeedbacks || []).map((feedback) => ({
          feature: feedback.feature,
          rating: feedback.rating,
          //   comment: feedback.comment,
          timestamp: feedback.timestamp,
        })),
        recentSearches: (user.searchQueries || []).map((search) => ({
          query: search.query,
          timestamp: search.createdAt,
        })),
        latestMetrics:
          user.userMetrics && user.userMetrics.length > 0
            ? {
                height: user.userMetrics[0].height ?? undefined,
                weight: user.userMetrics[0].weight ?? undefined,
                bmi: bmi ?? undefined,
                date: user.userMetrics[0].date,
              }
            : undefined,
      };

      return userContext;
    } catch (error) {
      this.logger.error(
        `Error fetching user context for ${numericUserId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
