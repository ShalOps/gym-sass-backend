import {
  Catch,
  ArgumentsHost,
  HttpException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ThrottlerException } from '@nestjs/throttler';

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    console.log('!!! DEBUG: WsExceptionFilter caught exception', exception);
    const client = host.switchToWs().getClient<Socket>();

    let errorPayload = {
      code: 'WS_INTERNAL_ERROR',
      message: 'Internal server error',
    };

    if (exception instanceof WsException) {
      const error = exception.getError();
      if (typeof error === 'string') {
        errorPayload = { code: 'WS_ERROR', message: error };
      } else if (typeof error === 'object' && error !== null) {
        const errorObj = error as { code?: string; message?: string };
        errorPayload = {
          code: errorObj.code || 'WS_ERROR',
          message: errorObj.message || 'Unknown error',
        };
      }
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      let message = exception.message;
      if (typeof response === 'string') {
        message = response;
      } else if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const msg = (response as { message: string | string[] }).message;
        message = Array.isArray(msg) ? msg.join(', ') : msg;
      }

      if (exception instanceof UnauthorizedException) {
        errorPayload = { code: 'WS_UNAUTHORIZED', message };
      } else if (exception instanceof ForbiddenException) {
        errorPayload = { code: 'WS_FORBIDDEN', message };
      } else if (exception instanceof BadRequestException) {
        errorPayload = { code: 'WS_BAD_REQUEST', message };
      } else if (exception instanceof ThrottlerException) {
        errorPayload = { code: 'WS_RATE_LIMIT', message: 'Too many requests' };
      } else {
        errorPayload = {
          code: `WS_ERROR_${status}`,
          message,
        };
      }
    } else if (exception instanceof Error) {
      errorPayload = {
        code: 'WS_INTERNAL_ERROR',
        message: 'Internal server error', // Mask internal errors in production
      };
      // console.error(exception); // Log internally
    }

    client.emit('exception', errorPayload);
  }
}
