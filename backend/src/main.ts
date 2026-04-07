import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';

/**
 * Arranca el servidor: CORS, seguridad básica, validación de formularios y documentación API.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const corsOriginsRaw = configService.get<string>('CORS_ORIGINS') ?? '';

  const rawParts = corsOriginsRaw.split(',');
  const allowedOrigins: string[] = [];
  for (const part of rawParts) {
    const trimmed = part.trim();
    if (trimmed.length > 0) {
      allowedOrigins.push(trimmed);
    }
  }

  if (nodeEnv === 'production' && allowedOrigins.length === 0) {
    throw new Error(
      'En producción debes definir CORS_ORIGINS (lista separada por comas).',
    );
  }
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Kanban TFG API')
      .setDescription(
        'Documentación de la API para el tablero Kanban gamificado',
      )
      .setVersion('0.1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(3000, '0.0.0.0');
}
void bootstrap();
