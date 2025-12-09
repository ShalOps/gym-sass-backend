import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Centralized CORS configuration for the application
 * Provides consistent CORS settings across HTTP and WebSocket endpoints
 */

// Environment-based CORS origins
export const getCorsOrigins = (): string[] => {
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',')
    : [
        // Development defaults
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:4200',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:4200',
        'http://127.0.0.1:8080',
        // Production - replace with your actual domain(s) // #ChangeInProduction
        // 'https://yourdomain.com',
        // 'https://app.yourdomain.com',
      ];

  return allowedOrigins;
};

// CORS validation function for WebSocket gateways
export const createCorsOriginValidator = () => {
  return function (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = getCorsOrigins();

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development, allow localhost variations dynamically
    if (process.env.NODE_ENV !== 'production') {
      try {
        const url = new URL(origin);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          return callback(null, true);
        }
      } catch {
        return callback(new Error('Invalid origin URL'), false);
      }
    }

    return callback(new Error('Not allowed by CORS'), false);
  };
};

// HTTP CORS configuration for main application
export const getHttpCorsConfig = (): CorsOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // Strict CORS for production
    return {
      origin: getCorsOrigins(),
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
      maxAge: 86400, // 24 hours
    };
  } else {
    // More permissive CORS for development
    return {
      origin: true, // Reflect request origin
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    };
  }
};

// WebSocket CORS configuration
export const getWebSocketCorsConfig = () => {
  return {
    origin: createCorsOriginValidator(),
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  };
};
