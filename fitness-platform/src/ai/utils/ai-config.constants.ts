/**
 * AI service configuration constants.
 *
 * This object centralizes all configuration values related to AI services, including
 * database query limits, AI processing thresholds, caching policies, circuit breaker settings,
 * and rate limiting. Adjust these values to fine-tune the behavior and performance of AI features
 * across the platform.
 *
 * @property DATABASE_LIMITS - Limits for various database queries, such as recommendations, reviews, and search results.
 * @property PROCESSING_LIMITS - Constraints for AI processing, including prompt/response length, retry attempts, and timeouts.
 * @property CACHE_CONFIG - Time-to-live (TTL) settings for different cache types, in minutes.
 * @property CIRCUIT_BREAKER - Circuit breaker parameters to handle repeated failures and recovery timing.
 * @property RATE_LIMITS - Request rate limits for different AI service endpoints, measured in requests per minute.
 *
 * @remarks
 * Use the `AIConfig` type for type-safe access to these configuration values.
 */

export const AI_CONFIG = {
  // Database query limits
  DATABASE_LIMITS: {
    RECOMMENDATIONS_PER_TYPE: 5,
    REVIEWS_PER_ITEM: 5,
    CLASSES_PER_GYM: 5,
    TRAINERS_PER_GYM: 5,
    GYMS_FOR_SUGGESTIONS: 8,
    CLASSES_FOR_SUGGESTIONS: 8,
    TRAINERS_FOR_SUGGESTIONS: 8,
    SEARCH_RESULTS: 10,
    USER_BOOKINGS: 10,
    USER_REVIEWS: 1,
    USER_FEEDBACK: 20,
    USER_SEARCHES: 10,
    USER_VIEWS: 10,
  },

  // AI processing limits
  PROCESSING_LIMITS: {
    MAX_PROMPT_LENGTH: 2000,
    MAX_OUTPUT_TOKENS: 1024,
    MAX_RETRIES: 3,
    TIMEOUT_MS: 30000,
  },

  // Caching configuration
  CACHE_CONFIG: {
    USER_CONTEXT_TTL_MINUTES: 30,
    CONVERSATION_TTL_MINUTES: 60,
    SEARCH_CACHE_TTL_MINUTES: 15,
  },

  // Circuit breaker configuration
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 5,
    RECOVERY_TIMEOUT_MS: 60000, // 1 minute
  },

  // Rate limiting (requests per minute)
  RATE_LIMITS: {
    GENERAL_AI_REQUESTS: 60,
    PREMIUM_AI_REQUESTS: 120,
    CHAT_REQUESTS: 30,
    RECOMMENDATION_REQUESTS: 20,
  },
} as const;

// Type-safe access to configuration
export type AIConfig = typeof AI_CONFIG;
