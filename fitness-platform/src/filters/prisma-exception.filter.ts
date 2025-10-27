import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
// import { Prisma } from '../../generated/prisma';
import { Prisma } from '@prisma/client';


@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';

    switch (exception.code) {
      case 'P2002': 
        status = HttpStatus.CONFLICT;
        message = `A record with this ${exception.meta?.target} already exists`;
        break;
      case 'P2003': 
        status = HttpStatus.BAD_REQUEST;
        message = `Invalid foreign key provided`;
        break;
      default:
        
        break;
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: exception.name,
    });
  }
}