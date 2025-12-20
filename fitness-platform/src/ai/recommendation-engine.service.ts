import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler, IntentData } from './intent-handler.interface';
import { DatabaseService } from '../database/database.service';
import { AiService } from './ai/ai.service';
import { SecurityService } from './utils/security.service';
import { AuditService } from './utils/audit.service';
import { UserContextService } from './utils/user-context.service';
import { z } from 'zod';

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
      return JSON.stringify({
        type: 'recommendation',
        items: [],
        note: 'Invalid user ID',
      });
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

      // Fetch some sample gyms, classes, trainers for AI to rank
      const [gyms, classes, trainers] = await Promise.all([
        this.database.gym.findMany({
          take: 5,
          include: { reviews: { take: 5 } },
        }),
        this.database.gymClasses.findMany({
          take: 5,
          include: { reviews: { take: 5 }, gym: true, trainer: true },
        }),
        this.database.user.findMany({
          where: { role: 'TRAINER' },
          take: 5,
        }),
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
            rating:
              g.reviews?.reduce((sum, r) => sum + r.rating, 0) /
              (g.reviews?.length || 1),
          })),
        )}
        Classes: ${JSON.stringify(
          classes.map((c) => ({
            id: c.classId,
            name: c.className,
            gym: c.gym?.gymName,
            trainer: c.trainer?.firstName + ' ' + c.trainer?.lastName,
            price: c.price,
            rating:
              c.reviews?.reduce((sum, r) => sum + r.rating, 0) /
              (c.reviews?.length || 1),
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
      return JSON.stringify({
        type: 'recommendation',
        items: [],
        note: 'Unable to generate recommendations at this time',
      });
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
}
