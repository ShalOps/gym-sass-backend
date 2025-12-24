import { v4 as uuidv4 } from 'uuid';
import {
  AIStandardResponseDto,
  AIResponseMetadataDto,
  AIErrorDto,
} from '../dto/standard-response.dto';

export class AIResponseBuilder {
  /**
   * Creates a successful standardized response
   * @param data The response data payload
   * @param feature The AI feature that processed the request
   * @param userId The user ID associated with the request
   * @param processingTime Time taken to process the request in milliseconds
   * @returns Standardized success response
   */
  static success<T>(
    data: T,
    feature: string,
    userId: string,
    processingTime: number,
  ): AIStandardResponseDto<T> {
    return {
      success: true,
      data,
      metadata: {
        requestId: uuidv4(),
        timestamp: new Date().toISOString(),
        processingTime,
        feature,
        userId,
      },
    };
  }

  /**
   * Creates an error standardized response
   * @param code Error code for programmatic handling
   * @param message Human-readable error message
   * @param feature The AI feature that encountered the error
   * @param userId The user ID associated with the request
   * @param processingTime Time taken before the error occurred
   * @param details Additional error details for debugging
   * @returns Standardized error response
   */
  static error<T = any>(
    code: string,
    message: string,
    feature: string,
    userId: string,
    processingTime: number,
    details?: unknown,
  ): AIStandardResponseDto<T> {
    return {
      success: false,
      data: null,
      metadata: {
        requestId: uuidv4(),
        timestamp: new Date().toISOString(),
        processingTime,
        feature,
        userId,
      },
      error: {
        code,
        message,
        details: details ?? undefined,
      },
    };
  }

  /**
   * Creates a standardized response from a service result that might be a JSON string
   * @param result Result from service method (could be object or JSON string)
   * @param feature The AI feature that processed the request
   * @param userId The user ID associated with the request
   * @param processingTime Time taken to process the request
   * @returns Standardized response with parsed data
   */
  static fromServiceResult<T>(
    result: string | T,
    feature: string,
    userId: string,
    processingTime: number,
  ): AIStandardResponseDto<T> {
    try {
      // If result is a string, try to parse it as JSON
      const data: T =
        typeof result === 'string' ? (JSON.parse(result) as T) : result;

      // Check if the parsed data is an error response
      interface StandardizedResponse<T> {
        success: boolean;
        data: T | null;
        error?: AIErrorDto;
        metadata?: AIResponseMetadataDto;
      }

      function isStandardizedResponse<T>(
        obj: unknown,
      ): obj is StandardizedResponse<T> {
        return (
          typeof obj === 'object' &&
          obj !== null &&
          'success' in obj &&
          'data' in obj
        );
      }

      if (isStandardizedResponse<T>(data)) {
        // This is already a standardized response, just update metadata
        return {
          success: data.success,
          data: data.data,
          error: data.error,
          metadata: {
            requestId: uuidv4(),
            timestamp: new Date().toISOString(),
            processingTime,
            feature,
            userId,
          },
        };
      }

      return this.success(data, feature, userId, processingTime);
    } catch {
      // If parsing fails, return the raw result as data
      return this.success(result as T, feature, userId, processingTime);
    }
  }
}
