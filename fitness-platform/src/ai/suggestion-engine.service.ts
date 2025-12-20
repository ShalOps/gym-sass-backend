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

@Injectable()
export class SuggestionEngineService implements IntentHandler {
  private readonly logger = new Logger(SuggestionEngineService.name);

  private suggestionSchema = z.array(
    z.object({
      type: z.enum(['gym', 'class', 'trainer']),
      id: z.number(),
      name: z.string(),
      description: z.string(),
      rating: z.number().optional(),
      location: z.string().optional(),
      price: z.number().optional(),
      categories: z.array(z.string()).optional(),
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
    this.logger.debug(`Suggestion handle for user=${data.userId}`);

    const userId = parseInt(data.userId);
    if (isNaN(userId)) {
      return JSON.stringify({
        type: 'suggestion',
        suggestions: [],
        note: 'Invalid user ID',
      });
    }

    try {
      // Get user context from cache or DB
      const user = await this.userContext.getUserContext(data.userId);

      if (!user) {
        return JSON.stringify({
          type: 'suggestion',
          suggestions: [],
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
        'suggestions',
        Object.keys(minimizedUserData),
      );

      // Build dynamic where clauses based on user preferences
      const gymWhere: Record<string, unknown> = this.buildGymWhereClause(user);
      const classWhere: Record<string, unknown> =
        this.buildClassWhereClause(user);
      const trainerWhere: Record<string, unknown> =
        this.buildTrainerWhereClause(user);

      // Fetch suggestions from database
      const [gyms, classes, trainers] = await Promise.all([
        this.database.gym.findMany({
          where: gymWhere,
          include: {
            reviews: { take: 5 },
          },
          take: 8,
        }),
        this.database.gymClasses.findMany({
          where: classWhere,
          include: {
            gym: true,
            trainer: true,
            reviews: { take: 5 },
          },
          take: 8,
        }),
        this.database.user.findMany({
          where: trainerWhere,
          take: 8,
        }),
      ]);

      // Convert to unified suggestion format
      const allSuggestions = [
        ...gyms.map((gym) => ({
          type: 'gym' as const,
          id: gym.gymId,
          name: gym.gymName,
          description: `Verified gym in ${gym.location}`,
          location: gym.location,
          rating:
            gym.reviews?.length > 0
              ? gym.reviews.reduce((sum, r) => sum + r.rating, 0) /
                gym.reviews.length
              : undefined,
        })),
        ...classes.map((cls) => ({
          type: 'class' as const,
          id: cls.classId,
          name: cls.className,
          description: `${cls.duration} class at ${cls.gym?.gymName}`,
          location: cls.gym?.location,
          price: cls.price,
          rating:
            cls.reviews?.length > 0
              ? cls.reviews.reduce((sum, r) => sum + r.rating, 0) /
                cls.reviews.length
              : undefined,
          categories: [cls.className.toLowerCase()],
        })),
        ...trainers.map((trainer) => ({
          type: 'trainer' as const,
          id: trainer.userId,
          name: `${trainer.firstName} ${trainer.lastName}`,
          description: `Trainer specializing in ${trainer.classTypes?.join(', ') || 'fitness'}`,
          categories: trainer.classTypes || [],
        })),
      ];

      // Use AI to rank suggestions based on user profile and message context
      const rankingPrompt: string = `
        User Profile: ${JSON.stringify({
          goals: user.goals,
          fitnessLevel: user.fitnessLevel,
          location: user.location,
          preferredLocations: user.preferredLocations,
          preferredTimes: user.preferredTimes,
          classTypes: user.classTypes,
          instructors: user.instructors,
          priceRange: user.priceRange,
          bookingHistory: user.recentBookings?.slice(0, 5).map((b) => ({
            className: b.className,
            rating: b.sessionRating,
            attended: b.attended,
          })),
          viewHistory: user.recentViews?.slice(0, 10),
          aiFeedback: user.recentFeedback,
        })}
        Available Suggestions: ${JSON.stringify(allSuggestions)}
        User Message: ${data.message}

        Rank these suggestions based on how well they match the user's fitness goals, preferences, location, budget, and past behavior.
        Consider goal alignment, location convenience, price suitability, and positive booking history.
        Return top 10 most relevant suggestions.
      `;

      const rankedSuggestions = await this.aiService.generateStructuredResponse(
        rankingPrompt,
        this.suggestionSchema,
      );

      return JSON.stringify({
        type: 'suggestion',
        suggestions: rankedSuggestions || [],
        summary: `Suggestions based on your ${user.goals?.join(', ') || 'fitness'} goals and preferences in ${user.location}.`,
      });
    } catch (error) {
      const errorMsg =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(`Error in suggestion engine: ${errorMsg}`);
      return JSON.stringify(
        createAIErrorResponse(
          'suggestion',
          AIErrorCode.SERVICE_UNAVAILABLE,
          'Unable to generate suggestions at this time',
          errorMsg,
          { suggestions: [] },
        ),
      );
    }
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
