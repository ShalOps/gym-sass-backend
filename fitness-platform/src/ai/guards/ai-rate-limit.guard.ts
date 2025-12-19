import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { WinstonLoggerService } from '../utils/winston-logger.service';
import { AuditService } from '../utils/audit.service';

@Injectable()
export class AIRateLimitGuard implements CanActivate {
  private readonly requests = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private readonly maxRequestsPerMinute = 10; // Conservative limit for AI calls
  private readonly windowMs = 60 * 1000; // 1 minute

  constructor(
    private logger: WinstonLoggerService,
    private auditService: AuditService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as { id?: string } | undefined;
    const body = request.body as { userId?: string } | undefined;
    const userId = user?.id ?? body?.userId ?? 'anonymous';

    const now = Date.now();
    const userRequests = this.requests.get(userId);

    if (!userRequests || now > userRequests.resetTime) {
      // Reset or initialize
      this.requests.set(userId, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (userRequests.count >= this.maxRequestsPerMinute) {
      this.auditService.logRateLimit(
        userId,
        request.url,
        this.maxRequestsPerMinute,
      );
      this.logger.warn(`Rate limit exceeded for user ${userId}`, {
        userId,
        count: userRequests.count,
        limit: this.maxRequestsPerMinute,
        url: request.url,
      });
      return false;
    }

    userRequests.count++;
    return true;
  }
}
