import { HttpException, HttpStatus } from '@nestjs/common';

export class AIUnavailableException extends HttpException {
  constructor(
    message: string = 'AI service is currently unavailable. Please try in a few moments.',
  ) {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message,
        error: 'AI Service Unavailable',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
