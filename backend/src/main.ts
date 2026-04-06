import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';

/**
 * Bootstrap principal de Nest:
 * - seguridad HTTP (helmet)
 * - CORS según entorno
 * - validación global de DTOs
 * - Swagger solo fuera de producción
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const corsOriginsRaw = configService.get<string>('CORS_ORIGINS') ?? '';
  const allowedOrigins = corsOriginsRaw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

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
  // Todas las rutas de backend quedan bajo /api.
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina campos extra no declarados en DTO.
      forbidNonWhitelisted: true, // Rechaza payloads con propiedades no permitidas.
      transform: true, // Aplica tipos/transformaciones definidas por DTO.
    }),
  );

  // Swagger solo fuera de producción para reducir superficie de reconocimiento.
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

  // Escucha en todas las interfaces para entorno Docker/LAN.
  await app.listen(3000, '0.0.0.0');
}
void bootstrap();
