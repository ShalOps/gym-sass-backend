import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler, IntentData } from './intent-handler.interface';
import { DatabaseService } from '../database/database.service';
import { AiService } from './ai/ai.service';
import { SecurityService } from './utils/security.service';
import { AuditService } from './utils/audit.service';
import { UserContextService } from './utils/user-context.service';
import { z } from 'zod';
import {
  createAIErrorResponse,
  AIErrorCode,
} from './dto/ai-error-response.dto';
import { AI_CONFIG } from './utils/ai-config.constants';

@Injectable()
export class RecommendationEngineService implements IntentHandler {
  private readonly logger = new Logger(RecommendationEngineService.name);

  private recommendationSchema = z.array(
    z.object({
      type: z.enum(['gym', 'class', 'trainer']),
      id: z.number(),
      name: z.string(),
      description: z.string(),
      rating: z.number().optional(),
      location: z.string().optional(),
      price: z.number().optional(),
    }),
  );

  constructor(
    private readonly database: DatabaseService,
    private readonly aiService: AiService,
    private readonly securityService: SecurityService,
    private readonly auditService: AuditService,
    private readonly userContext: UserContextService,
  ) {}

  async handle(data: IntentData): Promise<string> {
    this.logger.debug(`Recommendation handle for user=${data.userId}`);

    const userId = parseInt(data.userId);
    if (isNaN(userId)) {
      return JSON.stringify(
        createAIErrorResponse(
          'recommendation',
          AIErrorCode.INVALID_INPUT,
          'Invalid user ID provided',
          `Received invalid userId: ${data.userId}`,
        ),
      );
    }

    try {
      // Get user context from cache or DB
      const user = await this.userContext.getUserContext(data.userId);

      if (!user) {
        return JSON.stringify({
          type: 'recommendation',
          items: [],
          note: 'User not found',
        });
      }

      // Minimize user data for privacy before sending to AI
      const minimizedUserData = this.securityService.minimizeUserDataForAI({
        userId: user.userId,
        fitnessLevel: user.fitnessLevel,
        goals: user.goals?.join(', '),
        preferredTimes: user.preferredTimes?.join(', '),
        preferredLocations: user.preferredLocations?.join(', '),
        classTypes: user.classTypes?.join(', '),
        priceRange: user.priceRange
          ? JSON.stringify(user.priceRange)
          : undefined,
        equipmentAtHome: user.equipmentAtHome?.join(', '),
      });

      // Log data access for compliance
      this.auditService.logDataAccess(
        data.userId,
        'user_profile',
        'ai_personalization',
        Object.keys(minimizedUserData),
      );

      // Analyze booking patterns using pre-fetched data
      const bookingInsights = this.analyzeBookingPatterns(
        user.recentBookings.map((b) => ({
          attended: b.attended,
          sessionRating: b.sessionRating,
          class: { className: b.className },
        })),
        user.preferredTimes || [],
      );
      const interestPatterns = this.analyzeViewHistory(
        user.recentViews.map((v) => ({
          entityType: v.entityType,
          entityId: v.entityId,
        })),
      );

      // Build dynamic where clauses based on user preferences
      const gymWhere: Record<string, unknown> = this.buildGymWhereClause(user);
      const classWhere: Record<string, unknown> =
        this.buildClassWhereClause(user);
      const trainerWhere: Record<string, unknown> =
        this.buildTrainerWhereClause(user);

      // Fetch personalized gyms, classes, trainers from database
      const [gyms, classes, trainers] = await Promise.all([
        this.database.gym
          .findMany({
            where: gymWhere,
            include: {
              reviews: {
                select: { rating: true },
              },
              _count: {
                select: { reviews: true },
              },
            },
            take: AI_CONFIG.DATABASE_LIMITS.RECOMMENDATIONS_PER_TYPE,
          })
          .then((gyms) =>
            gyms.map((g) => ({
              gymId: g.gymId,
              gymName: g.gymName,
              location: g.location,
              verified: g.verified,
              averageRating:
                g.reviews.length > 0
                  ? g.reviews.reduce((sum, r) => sum + r.rating, 0) /
                    g.reviews.length
                  : undefined,
              reviewCount: g._count.reviews,
            })),
          ),
        this.database.gymClasses
          .findMany({
            where: classWhere,
            include: {
              gym: {
                select: { gymName: true },
              },
              trainer: {
                select: { firstName: true, lastName: true },
              },
              reviews: {
                select: { rating: true },
              },
              _count: {
                select: { reviews: true },
              },
            },
            take: AI_CONFIG.DATABASE_LIMITS.CLASSES_PER_GYM,
          })
          .then((classes) =>
            classes.map((c) => ({
              classId: c.classId,
              className: c.className,
              gymId: c.gymId,
              gymName: c.gym?.gymName || '',
              trainerId: c.trainerId || undefined,
              trainerName: c.trainerId
                ? `${c.trainer?.firstName} ${c.trainer?.lastName}`
                : undefined,
              price: c.price,
              duration: c.duration,
              averageRating:
                c.reviews.length > 0
                  ? c.reviews.reduce((sum, r) => sum + r.rating, 0) /
                    c.reviews.length
                  : undefined,
              reviewCount: c._count.reviews,
            })),
          ),
        this.database.user
          .findMany({
            where: trainerWhere,
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              classTypes: true,
            },
            take: AI_CONFIG.DATABASE_LIMITS.RECOMMENDATIONS_PER_TYPE,
          })
          .then((trainers) =>
            trainers.map((t) => ({
              userId: t.userId,
              firstName: t.firstName,
              lastName: t.lastName,
              classTypes: t.classTypes || [],
              averageRating: undefined, // Could be calculated if needed
            })),
          ),
      ]);

      const prompt = `
        User Profile: ${JSON.stringify({
          goals: minimizedUserData.goals,
          fitnessLevel: minimizedUserData.fitnessLevel,
          preferredLocations: minimizedUserData.preferredLocations,
          preferredTimes: minimizedUserData.preferredTimes,
          classTypes: minimizedUserData.classTypes,
          priceRange: minimizedUserData.priceRange,
          equipmentAtHome: minimizedUserData.equipmentAtHome,
          calculatedBMI: user.latestMetrics?.bmi,
          bookingInsights,
          interestPatterns,
          aiFeedback: user.recentFeedback,
        })}
        Available Options:
        Gyms: ${JSON.stringify(
          gyms.map((g) => ({
            id: g.gymId,
            name: g.gymName,
            location: g.location,
            rating: g.averageRating,
          })),
        )}
        Classes: ${JSON.stringify(
          classes.map((c) => ({
            id: c.classId,
            name: c.className,
            gym: c.gymName,
            trainer: c.trainerName,
            price: c.price,
            rating: c.averageRating,
          })),
        )}
        Trainers: ${JSON.stringify(
          trainers.map((t) => ({
            id: t.userId,
            name: t.firstName + ' ' + t.lastName,
            specialties: t.classTypes,
          })),
        )}
        Message: ${data.message}

        Based on the user's comprehensive profile, booking history, and preferences, recommend 3-5 personalized gyms, classes, or trainers that would best match their fitness goals and current situation. Consider their location preferences, budget, fitness level, and past behavior.

        Return a JSON array of recommendations with: type ('gym', 'class', or 'trainer'), id, name, description, rating, location, price.
      `;

      const aiResponse = await this.aiService.generateStructuredResponse(
        prompt,
        this.recommendationSchema,
      );

      return JSON.stringify({
        type: 'recommendation',
        items: aiResponse || [],
        explanation: `Personalized recommendations based on your profile and ${user.goals?.join(', ') || 'fitness'} goals.`,
      });
    } catch (error) {
      const errorMsg =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(`Error in recommendation engine: ${errorMsg}`);
      return JSON.stringify(
        createAIErrorResponse(
          'recommendation',
          AIErrorCode.SERVICE_UNAVAILABLE,
          'Unable to generate recommendations at this time',
          errorMsg,
          { items: [] },
        ),
      );
    }
  }

  private analyzeBookingPatterns(
    bookings: Array<{
      attended?: boolean;
      sessionRating?: number;
      class?: { className?: string };
    }>,
    userPreferredTimes: string[],
  ): {
    totalBookings: number;
    attendanceRate: number;
    averageRating: number;
    preferredTimes: string[];
    commonClasses: string[];
  } {
    const attendedCount = bookings.filter((b) => b.attended).length;
    const avgRating =
      bookings
        .filter((b) => typeof b.sessionRating === 'number')
        .reduce((sum, b) => sum + (b.sessionRating ?? 0), 0) /
      (bookings.filter((b) => typeof b.sessionRating === 'number').length || 1);

    return {
      totalBookings: bookings.length,
      attendanceRate: bookings.length > 0 ? attendedCount / bookings.length : 0,
      averageRating: avgRating,
      preferredTimes: userPreferredTimes,
      commonClasses: this.getMostCommonClasses(bookings),
    };
  }

  private analyzeViewHistory(
    viewHistory: Array<{ entityType: string; entityId: number }>,
  ): {
    totalViews: number;
    topEntityTypes: [string, number][];
    recentInterests: string[];
  } {
    const entityCounts: { [key: string]: number } = viewHistory.reduce(
      (acc, view) => {
        acc[view.entityType] = (acc[view.entityType] || 0) + 1;
        return acc;
      },
      {} as { [key: string]: number },
    );

    return {
      totalViews: viewHistory.length,
      topEntityTypes: Object.entries(entityCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3),
      recentInterests: viewHistory
        .slice(0, 5)
        .map((v) => `${v.entityType}:${v.entityId}`),
    };
  }

  private getMostCommonClasses(
    bookings: Array<{ class?: { className?: string } }>,
  ): string[] {
    const classCounts = bookings.reduce<Record<string, number>>(
      (acc, booking) => {
        const className = booking.class?.className;
        if (className) {
          acc[className] = (acc[className] || 0) + 1;
        }
        return acc;
      },
      {},
    );

    return Object.entries(classCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([className]) => className);
  }

  private buildGymWhereClause(user: {
    preferredLocations?: string[];
    location?: string;
    [key: string]: any;
  }): Record<string, unknown> {
    const where: Record<string, unknown> = {
      verified: true,
    };

    // Location preferences
    if (
      Array.isArray(user.preferredLocations) &&
      user.preferredLocations.length > 0
    ) {
      where.location = {
        in: user.preferredLocations,
      };
    } else if (user.location) {
      where.location = {
        contains: user.location.split(',')[0], // City-level matching
        mode: 'insensitive',
      };
    }

    return where;
  }

  private buildClassWhereClause(user: {
    classTypes?: string[];
    priceRange?: any;
    instructors?: number[];
  }): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    // Class type preferences
    if (Array.isArray(user.classTypes) && user.classTypes.length > 0) {
      where.className = {
        in: user.classTypes.map((type: string) => type.toLowerCase()),
      };
    }

    // Price range
    if (user.priceRange) {
      const priceRange: { min?: number; max?: number } =
        typeof user.priceRange === 'string'
          ? (JSON.parse(user.priceRange) as { min?: number; max?: number })
          : (user.priceRange as { min?: number; max?: number });
      if (priceRange?.max) {
        where.price = {
          ...(typeof where.price === 'object' && where.price !== null
            ? where.price
            : {}),
          lte: priceRange.max,
        };
      }
      if (priceRange?.min) {
        where.price = {
          ...(typeof where.price === 'object' && where.price !== null
            ? where.price
            : {}),
          gte: priceRange.min,
        };
      }
    }

    // Preferred instructors
    if (Array.isArray(user.instructors) && user.instructors.length > 0) {
      where.trainerId = {
        in: user.instructors,
      };
    }

    return where;
  }

  private buildTrainerWhereClause(user: {
    classTypes?: string[];
    instructors?: number[];
  }): Record<string, unknown> {
    const where: Record<string, unknown> = {
      role: 'TRAINER',
    };

    // Class type preferences
    if (user.classTypes?.length && user.classTypes.length > 0) {
      where.classTypes = {
        hasSome: user.classTypes,
      };
    }

    // Preferred instructors
    if (user.instructors?.length && user.instructors.length > 0) {
      where.userId = {
        in: user.instructors,
      };
    }

    return where;
  }
}
