import { z } from 'zod';

// Standard error response schema for AI services
export const aiErrorResponseSchema = z.object({
  type: z.string(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.string().optional(),
  }),
  data: z.any().optional(), // Optional fallback data
});

export type AIErrorResponse = z.infer<typeof aiErrorResponseSchema>;

// Error codes for different types of failures
export enum AIErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

// Helper function to create standardized error responses
export function createAIErrorResponse(
  type: string,
  errorCode: AIErrorCode,
  message: string,
  details?: string,
  fallbackData?: unknown,
): AIErrorResponse {
  return {
    type,
    error: {
      code: errorCode,
      message,
      details,
    },
    data: fallbackData,
  };
}
