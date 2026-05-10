import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';

/**
 * Convierte origenes cors en arreglo limpio
 */
function parseCorsOriginsList(corsOriginsRaw: string): string[] {
  const rawParts = corsOriginsRaw.split(',');
  const allowedOrigins: string[] = [];
  for (const rawPart of rawParts) {
    const corsOriginPart = rawPart.trim();
    if (corsOriginPart.length > 0) {
      allowedOrigins.push(corsOriginPart);
    }
  }
  return allowedOrigins;
}

/**
 * Activa swagger en entorno no productivo
 */
function setupSwaggerIfDev(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Geckard API')
    .setDescription('Documentación de la API de Geckard')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}

/**
 * Arranca la aplicacion
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  // Leer entorno y origenes cors desde config
  let nodeEnv = 'development';
  const nodeEnvRaw = configService.get<string>('NODE_ENV');
  if (nodeEnvRaw !== undefined && nodeEnvRaw !== null) {
    nodeEnv = nodeEnvRaw;
  }
  let corsOriginsRaw = '';
  const corsOriginsRawValue = configService.get<string>('CORS_ORIGINS');
  if (corsOriginsRawValue !== undefined && corsOriginsRawValue !== null) {
    corsOriginsRaw = corsOriginsRawValue;
  }

  const allowedOrigins = parseCorsOriginsList(corsOriginsRaw);

  // En produccion no permitimos cors abierto por defecto
  if (nodeEnv === 'production' && allowedOrigins.length === 0) {
    throw new Error('Falta CORS_ORIGINS en produccion.');
  }

  let corsOriginOption: boolean | string[];
  if (allowedOrigins.length > 0) {
    corsOriginOption = allowedOrigins;
  } else {
    corsOriginOption = true;
  }

  // Activar cors y seguridad base
  app.enableCors({
    origin: corsOriginOption,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  // Helmet agrega cabeceras basicas de seguridad
  app.use(helmet());
  app.setGlobalPrefix('api');
  // Validacion global para limpiar dto entrantes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (nodeEnv !== 'production') {
    // Swagger solo en desarrollo
    setupSwaggerIfDev(app);
  }

  await app.listen(3000, '0.0.0.0');
}

void bootstrap();
