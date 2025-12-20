import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { WinstonLoggerService } from '../utils/winston-logger.service';
import { CircuitBreakerService } from '../utils/circuit-breaker.service';
import { AIUnavailableException } from '../exceptions/ai-unavailable.exception';
import { AI_CONFIG } from '../utils/ai-config.constants';

@Injectable()
export class AiService {
  private genAI: GoogleGenAI;
  private modelName: string;

  // Zod schemas for structured outputs
  private intentSchema = z.object({
    intent: z.enum([
      'personalized_recommendations',
      'workout_plans',
      'gym_class_trainer_suggestions',
      'product_recommendations',
      'natural_language_search',
      'general_chat',
    ]),
    confidence: z.number().min(0).max(1),
  });

  // Schema for standard AI reply responses, ensuring consistent text output structure
  private replySchema = z.object({
    text: z.string(),
  });

  constructor(
    private configService: ConfigService,
    private logger: WinstonLoggerService,
    private circuitBreaker: CircuitBreakerService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      Logger.warn(
        'GEMINI_API_KEY environment variable is not set',
        'AiService',
      );
      // this.logger.warn('GEMINI_API_KEY environment variable is not set');
    }

    this.genAI = new GoogleGenAI({ apiKey });
    this.modelName = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-2.5-flash',
    );
  }

  // Retry wrapper with exponential backoff and circuit breaker
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = AI_CONFIG.PROCESSING_LIMITS.MAX_RETRIES,
    baseDelay = 1000,
  ): Promise<T> {
    return this.circuitBreaker.execute('gemini-api', async () => {
      let lastError: Error | undefined = undefined;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error as Error;
          const errorMessage =
            error &&
            typeof error === 'object' &&
            error !== null &&
            'message' in error &&
            typeof (error as { message?: unknown }).message === 'string'
              ? (error as { message: string }).message
              : String(error);
          this.logger.warn(`Attempt ${attempt + 1} failed: ${errorMessage}`, {
            attempt: attempt + 1,
            maxRetries,
            error: errorMessage,
          });

          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      throw new AIUnavailableException(
        `AI service failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
      );
    });
  }

  // Intent classification using Gemini with structured output (updated to use JSON mode)
  async classifyIntent(
    message: string,
  ): Promise<{ intent: string; confidence: number }> {
    this.logger.debug(`Classifying intent for message: ${message}`, {
      message,
    });

    const prompt = `
You are an AI assistant for a fitness platform. Classify the user's message into one of these intents:
- personalized_recommendations: Requests for personalized fitness recommendations
- workout_plans: Requests for workout plans or exercise routines
- gym_class_trainer_suggestions: Suggestions for gyms, classes, or trainers
- product_recommendations: Recommendations for fitness products or equipment
- natural_language_search: General search queries about fitness content
- general_chat: General conversation or questions not fitting other categories

User message: "${message}"
`;

    try {
      const result = await this.withRetry(async () => {
        const response = await this.genAI.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
            // @ts-expect-error zod-to-json-schema type incompatibility (works at runtime)
            responseJsonSchema: zodToJsonSchema(this.intentSchema),
            thinkingConfig: {
              thinkingBudget: 0, // Disable thinking for faster responses
            },
          },
        });
        return response;
      });

      const text = (result.text ?? '').trim();
      if (!text) {
        throw new Error('No text in response');
      }
      this.logger.debug(`Gemini response: ${text}`, { response: text });

      // Parse and validate JSON
      const parsed: unknown = JSON.parse(text);
      const validated = this.intentSchema.parse(parsed);

      this.logger.debug(
        `Classified intent: ${validated.intent} with confidence ${validated.confidence}`,
        { intent: validated.intent, confidence: validated.confidence },
      );
      return validated;
    } catch (error) {
      const errorMessage =
        error &&
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(`Error classifying intent: ${errorMessage}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        message,
      });

      // Fallback to general_chat with low confidence
      return { intent: 'general_chat', confidence: 0.5 };
    }
  }

  // Response generation using Gemini (updated to support config)
  async generateResponse(prompt: string): Promise<{ text: string }> {
    this.logger.debug(
      `Generating reply for prompt: ${prompt.substring(0, 100)}...`,
      { promptLength: prompt.length },
    );

    try {
      const result = await this.withRetry(async () => {
        const response = await this.genAI.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
            thinkingConfig: {
              thinkingBudget: 0, // Disable thinking for faster responses
            },
          },
        });
        return response;
      });

      const text = (result.text ?? '').trim();
      if (!text) {
        throw new Error('No text in response');
      }
      this.logger.debug(`Generated reply: ${text.substring(0, 100)}...`, {
        responseLength: text.length,
      });

      return { text };
    } catch (error) {
      const errorMessage =
        error &&
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(`Error generating reply: ${errorMessage}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        promptSnippet: prompt.substring(0, 100),
      });

      // Fallback response
      return {
        text: "I apologize, but I'm experiencing technical difficulties right now. Please try again later.",
      };
    }
  }

  // Optional: Method for structured generation with custom schema (updated to use JSON mode)
  async generateStructuredResponse<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<T> {
    this.logger.debug(
      `Generating structured response for prompt: ${prompt.substring(0, 100)}...`,
      { promptLength: prompt.length },
    );

    try {
      const result = await this.withRetry(async () => {
        const response = await this.genAI.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: {
            temperature: 0.1, // Lower temperature for more reliable JSON
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
            // @ts-expect-error zod-to-json-schema type incompatibility (works at runtime)
            responseJsonSchema: zodToJsonSchema(schema),
            thinkingConfig: {
              thinkingBudget: 0, // Disable thinking for faster responses
            },
          },
        });
        return response;
      });

      const text = (result.text ?? '').trim();
      if (!text) {
        throw new Error('No text in response');
      }
      const parsed: unknown = JSON.parse(text);
      const validated = schema.parse(parsed);

      return validated;
    } catch (error) {
      const errorMessage =
        error &&
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(
        `Error generating structured response: ${errorMessage}`,
        {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          promptSnippet: prompt.substring(0, 100),
        },
      );
      throw new AIUnavailableException(
        `Failed to generate structured response: ${errorMessage}`,
      );
    }
  }

  // Streaming response method for real-time AI generation
  async generateStreamResponse(prompt: string) {
    this.logger.debug(
      `Generating streaming response for prompt: ${prompt.substring(0, 100)}...`,
      { promptLength: prompt.length },
    );

    try {
      const response = await this.genAI.models.generateContentStream({
        model: this.modelName,
        contents: prompt,
        config: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
          thinkingConfig: {
            thinkingBudget: 0, // Disable thinking for faster responses
          },
        },
      });
      return response; // Returns an async iterable for streaming chunks
    } catch (error) {
      const errorMessage =
        error &&
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(
        `Error generating streaming response: ${errorMessage}`,
        {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          promptSnippet: prompt.substring(0, 100),
        },
      );
      throw new AIUnavailableException(
        `Streaming response failed: ${errorMessage}`,
      );
    }
  }

  // Streaming structured response method for real-time JSON generation
  async generateStructuredStreamResponse<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
  ) {
    this.logger.debug(
      `Generating structured streaming response for prompt: ${prompt.substring(0, 100)}...`,
      { promptLength: prompt.length },
    );

    try {
      const response = await this.genAI.models.generateContentStream({
        model: this.modelName,
        contents: prompt,
        config: {
          temperature: 0.1, // Lower temperature for more reliable JSON
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          // @ts-expect-error zod-to-json-schema type incompatibility (works at runtime)
          responseJsonSchema: zodToJsonSchema(schema),
          thinkingConfig: {
            thinkingBudget: 0, // Disable thinking for faster responses
          },
        },
      });
      return response; // Returns an async iterable for streaming structured JSON
    } catch (error) {
      const errorMessage =
        error &&
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(
        `Error generating structured streaming response: ${errorMessage}`,
        {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          promptSnippet: prompt.substring(0, 100),
        },
      );
      throw new AIUnavailableException(
        `Structured streaming response failed: ${errorMessage}`,
      );
    }
  }

  // Create a chat session for multi-turn conversations
  createChat() {
    this.logger.debug('Creating new chat session');

    try {
      const chat = this.genAI.chats.create({
        model: this.modelName,
        config: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
          thinkingConfig: {
            thinkingBudget: 0, // Disable thinking for faster responses
          },
        },
      });
      return chat;
    } catch (error) {
      const errorMessage =
        error &&
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(`Error creating chat session: ${errorMessage}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new AIUnavailableException(
        `Failed to create chat session: ${errorMessage}`,
      );
    }
  }
}
