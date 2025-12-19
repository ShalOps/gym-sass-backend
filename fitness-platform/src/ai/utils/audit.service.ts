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
   * Logs AI interaction for compliance and monitoring
   */
  logAIInteraction(logData: Omit<AIAuditLog, 'timestamp'>) {
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
  }

  /**
   * Logs data access for privacy compliance
   */
  logDataAccess(
    userId: string,
    dataType: string,
    purpose: string,
    accessedFields: string[],
  ) {
    this.logger.log('Data Access', {
      audit: true,
      type: 'data_access',
      userId,
      dataType,
      purpose,
      accessedFields,
      timestamp: new Date(),
    });
  }

  /**
   * Logs security events
   */
  logSecurityEvent(
    event: string,
    details: unknown,
    severity: 'low' | 'medium' | 'high' = 'medium',
  ) {
    this.logger.warn(`Security Event: ${event}`, {
      audit: true,
      type: 'security',
      event,
      details: details as Record<string, unknown>,
      severity,
      timestamp: new Date(),
    });
  }

  /**
   * Logs rate limiting events
   */
  logRateLimit(userId: string, endpoint: string, limit: number) {
    this.logger.warn('Rate Limit Exceeded', {
      audit: true,
      type: 'rate_limit',
      userId,
      endpoint,
      limit,
      timestamp: new Date(),
    });
  }

  /**
   * Sanitizes sensitive data for logging
   */
  private sanitizeForLogging(text: string): string {
    if (!text) return text;

    // Remove or mask sensitive patterns
    return text
      .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[CARD_NUMBER]') // Credit cards
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[SSN]') // SSN
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        '[EMAIL]',
      ) // Email
      .replace(/\b\d{10,15}\b/g, '[PHONE]'); // Phone numbers
  }

  /**
   * Generates compliance report (for future use)
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<any> {
    // This would query logs for compliance reporting
    // For now, return placeholder
    return {
      period: { startDate, endDate },
      totalInteractions: 0,
      dataAccessEvents: 0,
      securityEvents: 0,
      note: 'Compliance reporting not yet implemented - logs are stored in winston files',
    };
  }
}
