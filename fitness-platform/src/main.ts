import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from './filters/prisma-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { mkdir } from 'fs/promises';
import { UPLOADS_DIR_ABSOLUTE } from './config/paths.config';
import { getHttpCorsConfig } from './config/cors.config';
import helmet from 'helmet';
import { Request, Response } from 'express';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
async function bootstrap() {
  await mkdir(UPLOADS_DIR_ABSOLUTE, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Security Headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors(getHttpCorsConfig());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Security: Block public access to chat uploads
  // This must be placed BEFORE app.useStaticAssets
  app.use('/uploads/chat', (req: Request, res: Response) => {
    res.status(403).send('Forbidden');
  });
  // Serve static files from uploads directory
  app.useStaticAssets(UPLOADS_DIR_ABSOLUTE, {
    prefix: '/uploads/',
  });

  const config = new DocumentBuilder()
    .setTitle('Gym Platform API')
    .setDescription('API documentation for the gym management platform')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('gyms', 'Gym management endpoints')
    .addTag('services', 'Services management endpoints')
    .addTag('service-option', 'Service option management endpoints')
    .addTag(
      'service-option-assignment',
      'Service option assignment management endpoints',
    )
    .addTag('gym-classes', 'Gym classes management endpoint')
    .addTag('reviews', 'Gym Reviews management endpoints')
    .addTag('gym-class-reviews', 'Gym Class Reviews management endpoints')

    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
