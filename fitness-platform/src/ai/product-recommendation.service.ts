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
    private readonly userContext: UserContextService,
  ) {}

  async handle(data: IntentData): Promise<string> {
    this.logger.debug(`ProductRecommendation handle for user=${data.userId}`);

    const userId = parseInt(data.userId);
    if (isNaN(userId)) {
      return JSON.stringify(
        createAIErrorResponse(
          'product_recommendation',
          AIErrorCode.INVALID_INPUT,
          'Invalid user ID provided',
          `Received invalid userId: ${data.userId}`,
        ),
      );
    }

    try {
      // Get user context from cache or DB
      const user = await this.userContext.getUserContext(userId);

      if (!user) {
        return JSON.stringify({
          type: 'product_recommendation',
          products: [],
          note: 'User not found',
        });
      }

      // Sanitize user data for AI privacy compliance
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

      // Retrieve marketplace products tailored to user context
      const goalCategoryMap: Record<string, string[]> = {
        weightloss: ['SUPPLEMENTS', 'APPAREL'],
        'muscle-gain': ['SUPPLEMENTS', 'EQUIPMENT'],
        endurance: ['SUPPLEMENTS', 'EQUIPMENT'],
        flexibility: ['EQUIPMENT', 'APPAREL'],
        'strength-training': ['SUPPLEMENTS', 'EQUIPMENT'],
        'general-fitness': ['SUPPLEMENTS', 'EQUIPMENT'],
        recovery: ['SUPPLEMENTS', 'EQUIPMENT'],
        // Add more mappings as needed
      };

      let categories: string[] = [];
      if (user.goals) {
        for (const goal of user.goals) {
          const cats = goalCategoryMap[goal];
          if (cats) categories.push(...cats);
        }
        categories = [...new Set(categories)]; // Remove duplicates
      }

      const where: any = {};
      if (categories.length > 0) {
        where.category = { in: categories };
      }
      if (user.priceRange) {
        where.price = {};
        if (user.priceRange.min !== undefined)
          where.price.gte = user.priceRange.min;
        if (user.priceRange.max !== undefined)
          where.price.lte = user.priceRange.max;
      }

      // TODO: Remove 'as any' once colleague merges schema enhancements with AI fields
      const products = await (this.database as any).product.findMany({
        where,
        include: {
          vendor: {
            select: {
              firstName: true,
              lastName: true,
              vendorRating: true,
              verified: true,
            },
          },
        },
        take: 7,
        orderBy: { rating: 'desc' }, // Prioritize highly-rated products
        select: {
          productId: true,
          name: true,
          description: true,
          price: true,
          category: true,
          tags: true,
          targetFitnessLevels: true,
          targetGoals: true,
          rating: true,
          reviewCount: true,
          totalSold: true,
          inStock: true,
          vendor: true,
        },
      });

      if (products.length === 0) {
        return JSON.stringify({
          type: 'product_recommendation',
          products: [],
          explanation: 'No products found matching your criteria.',
        });
      }

      // Transform database products to AI-friendly format with essential recommendation data
      const productsList = products.map((p) => ({
        id: p.productId,
        name: p.name,
        description: p.description || '',
        price: p.price,
        category: p.category,
        tags: p.tags,
        targetFitnessLevels: p.targetFitnessLevels,
        targetGoals: p.targetGoals,
        rating: p.rating,
        reviewCount: p.reviewCount,
        totalSold: p.totalSold,
        inStock: p.inStock,
        vendor: {
          name:
            `${p.vendor?.firstName || ''} ${p.vendor?.lastName || ''}`.trim() ||
            'Unknown',
          rating: p.vendor?.vendorRating,
          verified: p.vendor?.verified,
        },
      }));

      const prompt = `
User Profile: ${JSON.stringify({
        goals: minimizedUserData.goals,
        fitnessLevel: user.fitnessLevel,
        priceRange: minimizedUserData.priceRange,
        equipmentAtHome: minimizedUserData.equipmentAtHome,
      })}

Available Products: ${JSON.stringify(productsList)}

Task: Recommend 3-5 products from the list that best match the user's fitness goals and level. Consider ratings, reviews, and vendor reputation. Prioritize products with high ratings and good availability.

Return JSON array with: id, name, description, price, category, reasoning (why it fits their profile).
`;

      const aiResponse = await this.aiService.generateStructuredResponse(
        prompt,
        this.productSchema,
      );

      return JSON.stringify({
        type: 'product_recommendation',
        products: aiResponse || [],
        explanation: `Recommendations based on your ${Array.isArray(user.goals) ? user.goals.join(', ') : user.goals || 'fitness'} goals and preferences.`,
      });
    } catch (error) {
      const errorMsg =
        error && typeof error === 'object' && 'message' in error
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(`Error in product recommendation: ${errorMsg}`);
      return JSON.stringify(
        createAIErrorResponse(
          'product_recommendation',
          AIErrorCode.SERVICE_UNAVAILABLE,
          'Unable to generate recommendations at this time',
          errorMsg,
          { products: [] },
        ),
      );
    }
  }
}
