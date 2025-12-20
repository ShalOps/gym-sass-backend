import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { WinstonLoggerService } from '../utils/winston-logger.service';
import { AuditService } from '../utils/audit.service';
import { AI_CONFIG } from '../utils/ai-config.constants';
import {
  AIErrorCode,
  createAIErrorResponse,
} from '../dto/ai-error-response.dto';

@Injectable()
export class AIRateLimitGuard implements CanActivate {
  private readonly requests = new Map<
    string,
    { count: number; resetTime: number }
  >();

  constructor(
    private logger: WinstonLoggerService,
    private auditService: AuditService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as { id?: string } | undefined;
    const body = request.body as { userId?: string } | undefined;
    const userId = user?.id ?? body?.userId;

    // Use user ID if available, otherwise fall back to IP address
    const identifier = userId ?? this.getClientIP(request);
    const endpoint = request.url;

    // Get rate limit for this endpoint
    const limit = this.getRateLimitForEndpoint(endpoint);
    const now = Date.now();
    const userRequests = this.requests.get(identifier);

    if (!userRequests || now > userRequests.resetTime) {
      // Reset or initialize
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + 60000, // 1 minute
      });

      // Add rate limit headers
      this.setRateLimitHeaders(request, 1, limit, now + 60000);
      return true;
    }

    if (userRequests.count >= limit) {
      this.auditService.logRateLimit(identifier, endpoint, limit);
      this.logger.warn(
        `Rate limit exceeded for ${userId ? 'user' : 'IP'} ${identifier}`,
        {
          identifier,
          count: userRequests.count,
          limit,
          endpoint,
          url: request.url,
        },
      );
      throw new HttpException(
        createAIErrorResponse(
          'rate_limit',
          AIErrorCode.RATE_LIMITED,
          `Rate limit exceeded. Maximum ${limit} requests per minute.`,
          `${userId ? 'User' : 'IP'} ${identifier} exceeded rate limit of ${limit} requests per minute`,
        ),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    userRequests.count++;

    // Add rate limit headers
    this.setRateLimitHeaders(
      request,
      userRequests.count,
      limit,
      userRequests.resetTime,
    );
    return true;
  }

  private getClientIP(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'] as string;
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  private getRateLimitForEndpoint(endpoint: string): number {
    if (endpoint.includes('/chat/')) {
      return AI_CONFIG.RATE_LIMITS.CHAT_REQUESTS;
    }
    if (endpoint.includes('/recommend')) {
      return AI_CONFIG.RATE_LIMITS.RECOMMENDATION_REQUESTS;
    }
    // Default to general limit for other endpoints
    return AI_CONFIG.RATE_LIMITS.GENERAL_AI_REQUESTS;
  }

  private setRateLimitHeaders(
    request: Request,
    currentCount: number,
    limit: number,
    resetTime: number,
  ): void {
    const response = request.res;
    if (response) {
      response.setHeader('X-RateLimit-Limit', limit.toString());
      response.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, limit - currentCount).toString(),
      );
      response.setHeader(
        'X-RateLimit-Reset',
        Math.ceil(resetTime / 1000).toString(),
      );
    }
  }
}
