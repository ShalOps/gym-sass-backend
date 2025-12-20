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
export class SearchEngineService implements IntentHandler {
  private readonly logger = new Logger(SearchEngineService.name);

  private searchResultSchema = z.array(
    z.object({
      type: z.enum(['gym', 'class', 'trainer']),
      id: z.number(),
      name: z.string(),
      description: z.string(),
      location: z.string().optional(),
      rating: z.number().optional(),
      price: z.number().optional(),
      relevanceScore: z.number(),
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
    this.logger.debug(
      `Search handle for user=${data.userId}, query=${data.message}`,
    );

    const userId = parseInt(data.userId);
    if (isNaN(userId)) {
      return JSON.stringify(
        createAIErrorResponse(
          'search',
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
          type: 'search',
          results: [],
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
        'natural_language_search',
        Object.keys(minimizedUserData),
      );

      // Parse the search query with AI to understand intent
      const parsePrompt = `
        Parse this search query and extract key information for fitness platform search:
        Query: "${data.message}"

        User Context:
        - Location: ${user.location}
        - Preferred Locations: ${typeof minimizedUserData.preferredLocations === 'string' ? minimizedUserData.preferredLocations : ''}
        - Goals: ${typeof minimizedUserData.goals === 'string' ? minimizedUserData.goals : ''}
        - Fitness Level: ${typeof minimizedUserData.fitnessLevel === 'string' ? minimizedUserData.fitnessLevel : ''}
        - Preferred Times: ${typeof minimizedUserData.preferredTimes === 'string' ? minimizedUserData.preferredTimes : ''}
        - Class Types: ${typeof minimizedUserData.classTypes === 'string' ? minimizedUserData.classTypes : ''}
        - Price Range: ${JSON.stringify(minimizedUserData.priceRange)}
        - Recent Searches: ${user.recentSearches
          ?.slice(0, 3)
          .map((s) => s.query)
          .join(', ')}
        - Recent Views: ${user.recentViews
          ?.slice(0, 5)
          .map((v) => `${v.entityType}:${v.entityId}`)
          .join(', ')}

        Extract:
        - searchType: "gym", "class", "trainer", or "general"
        - keywords: array of search terms
        - location: specific location mentioned
        - priceRange: {min, max} if mentioned
        - classType: specific class type
        - timePreference: morning/afternoon/evening
        - fitnessLevel: beginner/intermediate/advanced

        Return as JSON object.
      `;

      const parsedQuery = await this.aiService.generateStructuredResponse(
        parsePrompt,
        z.object({
          searchType: z.enum(['gym', 'class', 'trainer', 'general']),
          keywords: z.array(z.string()),
          location: z.string().optional(),
          priceRange: z
            .object({ min: z.number().optional(), max: z.number().optional() })
            .optional(),
          classType: z.string().optional(),
          timePreference: z.string().optional(),
          fitnessLevel: z.string().optional(),
        }),
      );

      // Perform database searches based on parsed query
      const searchResults = await this.performSearch(parsedQuery);

      // Use AI to rank and filter results based on user context
      const rankingPrompt = `
        User Profile: ${JSON.stringify({
          goals: user.goals,
          fitnessLevel: user.fitnessLevel,
          location: user.location,
          preferredLocations: user.preferredLocations,
          preferredTimes: user.preferredTimes,
          classTypes: user.classTypes,
          priceRange: user.priceRange,
          viewHistory: user.recentViews?.slice(0, 10),
          recentSearches: user.recentSearches?.slice(0, 5),
        })}
        Parsed Query: ${JSON.stringify(parsedQuery)}
        Search Results: ${JSON.stringify(searchResults)}

        Rank and filter these search results based on user preferences and relevance to the query.
        Return top 10 most relevant results with relevance scores (0-1).
        Consider location proximity, price match, goal alignment, and user history.
      `;

      const rankedResults = await this.aiService.generateStructuredResponse(
        rankingPrompt,
        this.searchResultSchema,
      );

      // Store search query for future learning
      await this.database.searchQuery.create({
        data: {
          query: data.message,
          userId,
          results: rankedResults,
          intent: parsedQuery.searchType,
        },
      });

      return JSON.stringify({
        type: 'search',
        results: rankedResults || [],
        interpretedQuery: `Searching for ${parsedQuery.searchType} with keywords: ${parsedQuery.keywords.join(', ')}`,
      });
    } catch (error) {
      const errorMessage =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(`Error in search engine: ${errorMessage}`);
      return JSON.stringify(
        createAIErrorResponse(
          'search',
          AIErrorCode.SERVICE_UNAVAILABLE,
          'Unable to perform search at this time',
          errorMessage,
          { results: [] },
        ),
      );
    }
  }

  private async performSearch(parsedQuery: {
    searchType: 'gym' | 'class' | 'trainer' | 'general';
    keywords: string[];
    location?: string;
    priceRange?: { min?: number; max?: number };
    classType?: string;
    timePreference?: string;
    fitnessLevel?: string;
  }) {
    type GymResult = {
      type: 'gym';
      id: number;
      name: string;
      description: string;
      location: string;
      rating?: number;
    };

    type ClassResult = {
      type: 'class';
      id: number;
      name: string;
      description: string;
      location?: string;
      rating?: number;
      price: number;
    };

    type TrainerResult = {
      type: 'trainer';
      id: number;
      name: string;
      description: string;
    };

    type SearchResult = GymResult | ClassResult | TrainerResult;

    const results: SearchResult[] = [];

    // Search gyms
    if (
      parsedQuery.searchType === 'gym' ||
      parsedQuery.searchType === 'general'
    ) {
      const gyms = await this.database.gym.findMany({
        where: {
          ...(parsedQuery.location && {
            location: { contains: parsedQuery.location, mode: 'insensitive' },
          }),
          verified: true,
        },
        include: {
          reviews: { take: AI_CONFIG.DATABASE_LIMITS.REVIEWS_PER_ITEM },
        },
        take: AI_CONFIG.DATABASE_LIMITS.SEARCH_RESULTS,
      });

      results.push(
        ...gyms.map(
          (gym): GymResult => ({
            type: 'gym',
            id: gym.gymId,
            name: gym.gymName,
            description: `Gym located in ${gym.location}`,
            location: gym.location,
            rating:
              gym.reviews?.length > 0
                ? gym.reviews.reduce((sum, r) => sum + r.rating, 0) /
                  gym.reviews.length
                : undefined,
          }),
        ),
      );
    }

    // Search classes
    if (
      parsedQuery.searchType === 'class' ||
      parsedQuery.searchType === 'general'
    ) {
      const classes = await this.database.gymClasses.findMany({
        where: {
          ...(parsedQuery.classType && {
            className: { contains: parsedQuery.classType, mode: 'insensitive' },
          }),
          ...(parsedQuery.priceRange?.max && {
            price: { lte: parsedQuery.priceRange.max },
          }),
          ...(parsedQuery.priceRange?.min && {
            price: { gte: parsedQuery.priceRange.min },
          }),
        },
        include: {
          gym: true,
          trainer: true,
          reviews: { take: AI_CONFIG.DATABASE_LIMITS.REVIEWS_PER_ITEM },
        },
        take: AI_CONFIG.DATABASE_LIMITS.SEARCH_RESULTS,
      });

      results.push(
        ...classes.map(
          (cls): ClassResult => ({
            type: 'class',
            id: cls.classId,
            name: cls.className,
            description: `Class at ${cls.gym?.gymName} with ${cls.trainer?.firstName} ${cls.trainer?.lastName}`,
            location: cls.gym?.location,
            rating:
              cls.reviews?.length > 0
                ? cls.reviews.reduce((sum, r) => sum + r.rating, 0) /
                  cls.reviews.length
                : undefined,
            price: cls.price,
          }),
        ),
      );
    }

    // Search trainers
    if (
      parsedQuery.searchType === 'trainer' ||
      parsedQuery.searchType === 'general'
    ) {
      const trainers = await this.database.user.findMany({
        where: {
          role: 'TRAINER',
          ...(parsedQuery.keywords?.length > 0 && {
            OR: [
              {
                firstName: {
                  contains: parsedQuery.keywords[0],
                  mode: 'insensitive',
                },
              },
              {
                lastName: {
                  contains: parsedQuery.keywords[0],
                  mode: 'insensitive',
                },
              },
              { classTypes: { hasSome: parsedQuery.keywords } },
            ],
          }),
        },
        take: AI_CONFIG.DATABASE_LIMITS.SEARCH_RESULTS,
      });

      results.push(
        ...trainers.map(
          (trainer): TrainerResult => ({
            type: 'trainer',
            id: trainer.userId,
            name: `${trainer.firstName} ${trainer.lastName}`,
            description: `Trainer specializing in ${trainer.classTypes?.join(', ') || 'various classes'}`,
          }),
        ),
      );
    }

    return results;
  }
}
