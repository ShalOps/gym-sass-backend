import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler, IntentData } from './intent-handler.interface';
import { DatabaseService } from '../database/database.service';
import { AiService } from './ai/ai.service';
import { SecurityService } from './utils/security.service';
import { AuditService } from './utils/audit.service';
import { z } from 'zod';

@Injectable()
export class ProductRecommendationService implements IntentHandler {
  private readonly logger = new Logger(ProductRecommendationService.name);

  private productSchema = z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      description: z.string(),
      price: z.number(),
      category: z.string(),
      reasoning: z.string(),
    }),
  );

  constructor(
    private readonly database: DatabaseService,
    private readonly aiService: AiService,
    private readonly securityService: SecurityService,
    private readonly auditService: AuditService,
  ) {}

  async handle(data: IntentData): Promise<string> {
    this.logger.debug(`ProductRecommendation handle for user=${data.userId}`);

    const userId = parseInt(data.userId);
    if (isNaN(userId)) {
      return JSON.stringify({
        type: 'product_recommendation',
        products: [],
        note: 'Invalid user ID',
      });
    }

    try {
      // Fetch user profile with relevant data
      const user = await this.database.user.findUnique({
        where: { userId },
        include: {
          viewHistories: {
            where: { entityType: 'product' },
            take: 20,
            orderBy: { timestamp: 'desc' },
          },
          aifeedbacks: {
            where: { feature: 'product_recommendation' },
            take: 10,
            orderBy: { timestamp: 'desc' },
          },
        },
      });

      if (!user) {
        return JSON.stringify({
          type: 'product_recommendation',
          products: [],
          note: 'User not found',
        });
      }

      // Minimize user data for privacy before sending to AI
      const minimizedUserData = this.securityService.minimizeUserDataForAI({
        userId: user.userId,
        fitnessLevel: user.fitnessLevel ?? undefined,
        goals: Array.isArray(user.goals)
          ? user.goals.join(', ')
          : (user.goals ?? undefined),
        preferredTimes: Array.isArray(user.preferredTimes)
          ? user.preferredTimes.join(', ')
          : (user.preferredTimes ?? undefined),
        preferredLocations: Array.isArray(user.preferredLocations)
          ? user.preferredLocations.join(', ')
          : (user.preferredLocations ?? undefined),
        classTypes: Array.isArray(user.classTypes)
          ? user.classTypes.join(', ')
          : (user.classTypes ?? undefined),
        priceRange:
          user.priceRange !== undefined
            ? typeof user.priceRange === 'object'
              ? JSON.stringify(user.priceRange)
              : String(user.priceRange)
            : undefined,
        equipmentAtHome: Array.isArray(user.equipmentAtHome)
          ? user.equipmentAtHome.join(', ')
          : (user.equipmentAtHome ?? undefined),
      });

      // Log data access for compliance
      this.auditService.logDataAccess(
        data.userId,
        'user_profile',
        'product_recommendations',
        Object.keys(minimizedUserData),
      );

      // For MVP, since marketplace models don't exist yet, use AI to generate recommendations
      const prompt = `
        User Profile: ${JSON.stringify({
          goals: minimizedUserData.goals,
          preferences: user.preferences,
          priceRange: minimizedUserData.priceRange,
          equipmentAtHome: minimizedUserData.equipmentAtHome,
          lastActiveAt: user.lastActiveAt,
          viewHistory: user.viewHistories?.slice(0, 5), // Recent product views
          aiFeedback: user.aifeedbacks,
        })}
        Message: ${data.message}

        Based on the user's fitness goals, preferences, and browsing history, recommend 3-5 fitness-related products (supplements, equipment, apparel) that would help them achieve their goals. Consider their budget and existing equipment.

        Return a JSON array of products with: id (use sequential numbers), name, description, estimated price range, category, and why it fits their profile.
      `;

      const aiResponse = await this.aiService.generateStructuredResponse(
        prompt,
        this.productSchema,
      );

      return JSON.stringify({
        type: 'product_recommendation',
        products: aiResponse || [],
        explanation: `Recommendations based on your ${user.goals?.join(', ') || 'fitness'} goals and preferences.`,
      });
    } catch (error) {
      const errorMsg =
        error && typeof error === 'object' && 'message' in error
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(`Error in product recommendation: ${errorMsg}`);
      return JSON.stringify({
        type: 'product_recommendation',
        products: [],
        note: 'Unable to generate recommendations at this time',
      });
    }
  }
}
