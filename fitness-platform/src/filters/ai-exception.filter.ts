import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Response } from 'express';
import { AIUnavailableException } from '../ai/exceptions/ai-unavailable.exception';

@Catch(AIUnavailableException)
export class AIFilter implements ExceptionFilter {
  private readonly logger = new Logger(AIFilter.name);

  catch(exception: AIUnavailableException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const errorResponse = exception.getResponse();

    this.logger.error(
      `AI Error: ${JSON.stringify(errorResponse)} - URL: ${request.url || 'unknown'} - User-Agent: ${request.headers?.['user-agent'] || 'unknown'}`,
    );

    response.status(status).json({
      statusCode: status,
      message:
        'AI service is temporarily unavailable. Please try again in a few moments.',
      timestamp: new Date().toISOString(),
    });
  }
}
