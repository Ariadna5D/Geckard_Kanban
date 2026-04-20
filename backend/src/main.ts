import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';

// Convierte "http://a.com, http://b.com" en un array de orígenes (sin huecos vacíos).
function parseCorsOriginsList(corsOriginsRaw: string): string[] {
  const rawParts = corsOriginsRaw.split(',');
  const allowedOrigins: string[] = [];
  for (let i = 0; i < rawParts.length; i++) {
    const corsOriginPart = rawParts[i].trim();
    if (corsOriginPart.length > 0) {
      allowedOrigins.push(corsOriginPart);
    }
  }
  return allowedOrigins;
}

// Lee una variable de entorno como texto; si no existe, devuelve whenMissing.
function readStringConfig(
  configService: ConfigService,
  key: string,
  whenMissing: string,
): string {
  const value = configService.get<string>(key);
  if (value === undefined || value === null) {
    return whenMissing;
  }
  return value;
}

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  const nodeEnv = readStringConfig(configService, 'NODE_ENV', 'development');
  const corsOriginsRaw = readStringConfig(configService, 'CORS_ORIGINS', '');

  const allowedOrigins = parseCorsOriginsList(corsOriginsRaw);

  if (nodeEnv === 'production' && allowedOrigins.length === 0) {
    throw new Error(
      'En producción debes definir CORS_ORIGINS (lista separada por comas).',
    );
  }

  let corsOriginOption: boolean | string[];
  if (allowedOrigins.length > 0) {
    corsOriginOption = allowedOrigins;
  } else {
    corsOriginOption = true;
  }

  app.enableCors({
    origin: corsOriginOption,
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
    setupSwaggerIfDev(app);
  }

  // 0.0.0.0: aceptar conexiones desde Docker u otras máquinas en la red local.
  await app.listen(3000, '0.0.0.0');
}

void bootstrap();
