import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class WinstonLoggerService {
  private logger: winston.Logger;

  constructor() {
    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      try {
        fs.mkdirSync(logsDir, { recursive: true });
      } catch (error) {
        console.error('Failed to create logs directory:', error);
        // Fallback to console-only logging if directory creation fails
        this.logger = winston.createLogger({
          level: 'info',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
          defaultMeta: { service: 'ai-service' },
          transports: [
            new winston.transports.Console({
              format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple(),
              ),
            }),
          ],
        });
        return;
      }
    }

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: 'ai-service' },
      transports: [
        new winston.transports.File({
          filename: path.join(logsDir, 'ai-error.log'),
          level: 'error',
        }),
        new winston.transports.File({
          filename: path.join(logsDir, 'ai-combined.log'),
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
      ],
    });
  }

  log(message: string, meta?: Record<string, unknown>) {
    try {
      this.logger.info(message, meta);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Failed to log message',
          error: errorMessage,
          timestamp: new Date().toISOString(),
          service: 'ai-service',
          originalMessage: message,
          originalMeta: meta,
        }),
      );
    }
  }

  error(message: string, meta?: Record<string, unknown>) {
    try {
      this.logger.error(message, meta);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Failed to log error',
          error: errorMessage,
          timestamp: new Date().toISOString(),
          service: 'ai-service',
          originalMessage: message,
          originalMeta: meta,
        }),
      );
    }
  }

  warn(message: string, meta?: Record<string, unknown>) {
    try {
      this.logger.warn(message, meta);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Failed to log warning',
          error: errorMessage,
          timestamp: new Date().toISOString(),
          service: 'ai-service',
          originalMessage: message,
          originalMeta: meta,
        }),
      );
    }
  }

  debug(message: string, meta?: Record<string, unknown>) {
    try {
      this.logger.debug(message, meta);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Failed to log debug',
          error: errorMessage,
          timestamp: new Date().toISOString(),
          service: 'ai-service',
          originalMessage: message,
          originalMeta: meta,
        }),
      );
    }
  }

  info(message: string, meta?: Record<string, unknown>) {
    try {
      this.logger.info(message, meta);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Failed to log info',
          error: errorMessage,
          timestamp: new Date().toISOString(),
          service: 'ai-service',
          originalMessage: message,
          originalMeta: meta,
        }),
      );
    }
  }
}
