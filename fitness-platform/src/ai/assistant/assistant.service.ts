import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { ConversationManagerService } from '../conversation-manager/conversation-manager.service';
import { IntentHandler } from '../intent-handler.interface';
import { RecommendationEngineService } from '../recommendation-engine.service';
import { WorkoutPlannerService } from '../workout-planner.service';
import { SuggestionEngineService } from '../suggestion-engine.service';
import { ProductRecommendationService } from '../product-recommendation.service';
import { SearchEngineService } from '../search-engine.service';
import { SecurityService } from '../utils/security.service';
import { AuditService } from '../utils/audit.service';
import { RecommendationRequestDto } from '../dto/recommendation.dto';
import { WorkoutPlanRequestDto } from '../dto/workout-plan.dto';
import { SuggestionRequestDto } from '../dto/suggestion.dto';
import { ProductRecommendationRequestDto } from '../dto/product-recommendation.dto';
import { SearchRequestDto } from '../dto/search.dto';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  // Intent to handler mapping
  private readonly intentHandlers: Record<string, IntentHandler> = {};

  constructor(
    private readonly aiService: AiService,
    private readonly conversationManager: ConversationManagerService,
    private readonly recommendationEngine: RecommendationEngineService,
    private readonly workoutPlanner: WorkoutPlannerService,
    private readonly suggestionEngine: SuggestionEngineService,
    private readonly productRecommendation: ProductRecommendationService,
    private readonly searchEngine: SearchEngineService,
    private readonly securityService: SecurityService,
    private readonly auditService: AuditService,
  ) {
    // Initialize intent handlers mapping
    this.intentHandlers = {
      personalized_recommendations: {
        handle: async (intentData) => {
          const result = await this.recommendationEngine.handle(intentData);
          return JSON.stringify(result);
        },
      },
      workout_plans: {
        handle: async (intentData) => {
          const result = await this.workoutPlanner.handle(intentData);
          return JSON.stringify(result);
        },
      },
      gym_class_trainer_suggestions: {
        handle: async (intentData) => {
          const result = await this.suggestionEngine.handle(intentData);
          return JSON.stringify(result);
        },
      },
      product_recommendations: {
        handle: async (intentData) => {
          const result = await this.productRecommendation.handle(intentData);
          return JSON.stringify(result);
        },
      },
      natural_language_search: {
        handle: async (intentData) => {
          const result = await this.searchEngine.handle(intentData);
          return JSON.stringify(result);
        },
      },
    };
  }

  /**
   * Orchestrates feature-specific AI requests with security and auditing
   * @param userId - The user's ID
   * @param feature - The feature being accessed
   * @param action - The action being performed
   * @param input - The raw user input
   * @param executionFn - The function to execute after sanitization
   * @returns The result of the execution function
   */
  private async executeSecurely<T>(
    userId: string,
    feature: string,
    action: string,
    input: string,
    executionFn: (sanitizedInput: string) => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();
    const validation = this.securityService.validateAndSanitizeMessage(input);

    if (!validation.isValid) {
      this.auditService.logSecurityEvent(`invalid_input_${feature}`, {
        userId,
        error: validation.error,
      });
      throw new BadRequestException(validation.error);
    }

    const sanitizedInput = validation.sanitizedMessage;

    try {
      const result = await executionFn(sanitizedInput);

      this.auditService.logAIInteraction({
        userId,
        action,
        feature,
        input: sanitizedInput,
        output: typeof result === 'string' ? result : JSON.stringify(result),
        processingTime: Date.now() - startTime,
        success: true,
      });

      return result;
    } catch (error) {
      this.auditService.logAIInteraction({
        userId,
        action,
        feature,
        input: sanitizedInput,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Process message with intent-based routing
  async processMessage(
    userId: string,
    message: string,
    conversationId?: string,
    userTier?: string,
  ) {
    const startTime = Date.now();
    const validation = this.securityService.validateAndSanitizeMessage(message);

    if (!validation.isValid) {
      this.auditService.logSecurityEvent('invalid_input', {
        userId,
        error: validation.error,
      });
      throw new BadRequestException(validation.error);
    }

    const sanitizedMessage = validation.sanitizedMessage;

    try {
      this.logger.debug(
        `processMessage user=${userId} conversation=${conversationId} tier=${userTier}`,
      );

      const conv = await this.conversationManager.loadConversation(
        userId,
        conversationId,
      );
      conv.messages.push({
        role: 'user',
        text: sanitizedMessage,
        timestamp: new Date().toISOString(),
      });

      const classification =
        await this.aiService.classifyIntent(sanitizedMessage);

      let reply: string;
      if (classification.intent === 'general_chat') {
        // Fallback to general AI reply for non-specific intents
        const gen = await this.aiService.generateResponse(sanitizedMessage);
        reply = gen.text;
      } else {
        // Route to specific intent handler
        const handler = this.intentHandlers[classification.intent];
        if (handler) {
          const intentData = {
            userId,
            message: sanitizedMessage,
            conversationId,
            userTier,
          };
          const handlerReply = await handler.handle(intentData);
          reply =
            typeof handlerReply === 'string'
              ? handlerReply
              : JSON.stringify(handlerReply);
        } else {
          this.logger.warn(
            `No handler found for intent: ${classification.intent}`,
          );
          const gen = await this.aiService.generateResponse(sanitizedMessage);
          reply = gen.text;
        }
      }

      conv.messages.push({
        role: 'assistant',
        text: typeof reply === 'string' ? reply : JSON.stringify(reply),
        timestamp: new Date().toISOString(),
        metadata: { intent: classification },
      });
      await this.conversationManager.saveConversation(conv);

      const result = {
        userId,
        conversationId: conv.id,
        intent: classification.intent,
        confidence: classification.confidence,
        reply,
        timestamp: new Date().toISOString(),
      };

      // Log successful interaction
      this.auditService.logAIInteraction({
        userId,
        action: 'chat_message',
        feature: classification.intent,
        input: sanitizedMessage,
        output: reply,
        processingTime: Date.now() - startTime,
        success: true,
      });

      return result;
    } catch (error) {
      // Log failed interaction
      this.auditService.logAIInteraction({
        userId,
        action: 'chat_message',
        feature: 'chat',
        input: sanitizedMessage,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Process message with streaming response
  async processMessageStream(
    userId: string,
    message: string,
    conversationId?: string,
    userTier?: string,
  ) {
    const startTime = Date.now();
    const validation = this.securityService.validateAndSanitizeMessage(message);

    if (!validation.isValid) {
      this.auditService.logSecurityEvent('invalid_input_stream', {
        userId,
        error: validation.error,
      });
      throw new BadRequestException(validation.error);
    }

    const sanitizedMessage = validation.sanitizedMessage;

    try {
      this.logger.debug(
        `processMessageStream user=${userId} conversation=${conversationId} tier=${userTier}`,
      );

      // Log interaction start
      this.auditService.logAIInteraction({
        userId,
        action: 'chat_stream_start',
        feature: 'general_chat',
        input: sanitizedMessage,
        processingTime: Date.now() - startTime,
        success: true,
      });

      // For streaming, we'll just use the general AI response for now
      // as feature-specific streaming requires more complex orchestration
      return this.aiService.generateStreamResponse(sanitizedMessage);
    } catch (error) {
      this.auditService.logAIInteraction({
        userId,
        action: 'chat_stream_error',
        feature: 'general_chat',
        input: sanitizedMessage,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getRecommendations(userId: string, query: RecommendationRequestDto) {
    const input = `Recommendations for ${query.categories ? query.categories.join(', ') : 'fitness'} in ${query.location || 'any location'}`;
    return this.executeSecurely(
      userId,
      'personalized_recommendations',
      'get_recommendations',
      input,
      () => this.recommendationEngine.handle({ userId, message: input }),
    );
  }

  async getWorkoutPlan(userId: string, query: WorkoutPlanRequestDto) {
    const input = `Workout plan for fitness level: ${query.fitnessLevel}, goals: ${query.goals?.join(', ')}`;
    return this.executeSecurely(
      userId,
      'workout_plans',
      'get_plan',
      input,
      () => this.workoutPlanner.handle({ userId, message: input }),
    );
  }

  async getSuggestions(userId: string, query: SuggestionRequestDto) {
    const input = `Suggest ${query.type} in ${query.location}`;
    return this.executeSecurely(
      userId,
      'gym_class_trainer_suggestions',
      'get_suggestions',
      input,
      () => this.suggestionEngine.handle({ userId, message: input }),
    );
  }

  async getProductRecommendations(
    userId: string,
    query: ProductRecommendationRequestDto,
  ) {
    const input = `Recommend products for goals: ${query.goals?.join(', ')}`;
    return this.executeSecurely(
      userId,
      'product_recommendations',
      'get_products',
      input,
      () => this.productRecommendation.handle({ userId, message: input }),
    );
  }

  async search(userId: string, query: SearchRequestDto) {
    const input = query.query || '';
    return this.executeSecurely(
      userId,
      'natural_language_search',
      'search',
      input,
      () => this.searchEngine.handle({ userId, message: input }),
    );
  }
}
