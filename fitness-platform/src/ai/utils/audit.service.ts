import { Injectable } from '@nestjs/common';
import { WinstonLoggerService } from './winston-logger.service';

interface AIAuditLog {
  userId: string;
  action: string;
  feature: string;
  input: string;
  output?: string;
  processingTime?: number;
  success: boolean;
  error?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

@Injectable()
export class AuditService {
  constructor(private logger: WinstonLoggerService) {}

  /**
   * Log AI interaction details for auditing purposes
   * @param logData Data related to the AI interaction
   */
  logAIInteraction(logData: Omit<AIAuditLog, 'timestamp'>) {
    try {
      const auditLog: AIAuditLog = {
        ...logData,
        timestamp: new Date(),
      };

      // Log to Winston with structured data
      this.logger.log('AI Interaction', {
        audit: true,
        ...auditLog,
        // Sanitize sensitive data in logs
        input: this.sanitizeForLogging(logData.input),
        output: logData.output
          ? this.sanitizeForLogging(logData.output)
          : undefined,
      });
    } catch (error) {
      // Silently fail logging to avoid disrupting the main flow
      this.logger.error('Failed to log AI interaction:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Log data access for privacy compliance
   * @param userId ID of the user whose data was accessed
   * @param dataType Type of data accessed
   * @param purpose Purpose of data access
   * @param accessedFields List of fields that were accessed
   */
  logDataAccess(
    userId: string,
    dataType: string,
    purpose: string,
    accessedFields: string[],
  ) {
    try {
      this.logger.log('Data Access', {
        audit: true,
        type: 'data_access',
        userId,
        dataType,
        purpose,
        accessedFields,
        timestamp: new Date(),
      });
    } catch (error) {
      // Silently fail logging to avoid disrupting the main flow
      this.logger.error('Failed to log data access:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Log security events
   * @param event Description of the security event
   * @param details Additional details about the event
   * @param severity Severity level of the event
   */
  logSecurityEvent(
    event: string,
    details: unknown,
    severity: 'low' | 'medium' | 'high' = 'medium',
  ) {
    try {
      // Sanitize details if it's an object
      const sanitizedDetails = this.sanitizeObject(details);

      this.logger.warn(`Security Event: ${event}`, {
        audit: true,
        type: 'security',
        event,
        details: sanitizedDetails,
        severity,
        timestamp: new Date(),
      });
    } catch (error) {
      // Silently fail logging to avoid disrupting the main flow
      this.logger.error('Failed to log security event:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Log rate limiting events
   * @param userId ID of the user who was rate limited
   * @param endpoint The API endpoint that was rate limited
   * @param limit The rate limit that was exceeded
   */
  logRateLimit(userId: string, endpoint: string, limit: number) {
    try {
      this.logger.warn('Rate Limit Exceeded', {
        audit: true,
        type: 'rate_limit',
        userId,
        endpoint,
        limit,
        timestamp: new Date(),
      });
    } catch (error) {
      // Silently fail logging to avoid disrupting the main flow
      this.logger.error('Failed to log rate limit:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Sanitizes sensitive data for logging
   * @param text Input text to sanitize
   * @returns Sanitized text
   */
  private sanitizeForLogging(text: string): string {
    if (!text) return text;

    // Remove or mask sensitive patterns
    return text
      .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[CARD_NUMBER]') // Credit cards
      .replace(/\b\d{10,15}\b/g, '[PHONE]') // Phone numbers (10-15 digits)
      .replace(/(\d{3}[-.]?\d{2}[-.]?\d{4})/g, '[SSN]') // SSN (3-2-4 digits with optional separators)
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        '[EMAIL]',
      ); // Email
  }

  /**
   * Sanitizes an object recursively
   * @param obj Input object
   * @returns Sanitized object
   */
  private sanitizeObject(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return this.sanitizeForLogging(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.sanitizeObject(value);
      }
      return result;
    }

    return obj;
  }

  /**
   * Generates compliance report (for future use)
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<any> {
    // Placeholder: In a production implementation, this method would query and aggregate logs for compliance reporting.
    // Currently, this functionality is not implemented.
    return {
      period: { startDate, endDate },
      totalInteractions: 0,
      dataAccessEvents: 0,
      securityEvents: 0,
      note: 'Compliance reporting not yet implemented - logs are stored in winston files',
    };
  }
}
