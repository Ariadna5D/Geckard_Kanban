import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';

/**
 * Parsea una lista de orígenes permitidos para CORS a partir de una cadena separada por comas.
 * @param corsOriginsRaw  La cadena de texto con los orígenes separados por comas.
 * @returns  Un array de orígenes permitidos para CORS.
 */
function parseCorsOriginsList(corsOriginsRaw: string): string[] {
  const rawParts = corsOriginsRaw.split(',');
  const allowedOrigins: string[] = [];
  for (let i = 0; i < rawParts.length; i++) {
    const trimmed = rawParts[i].trim();
    if (trimmed.length > 0) {
      allowedOrigins.push(trimmed);
    }
  }
  return allowedOrigins;
}

/**
 *  Lee una variable de entorno como string, con un valor por defecto si no está definida
 * @param configService  El servicio de configuración para acceder a las variables de entorno
 * @param key  La clave de la variable de entorno a leer
 * @param whenMissing  El valor por defecto a usar si la variable no está definida
 * @returns  El valor de la variable de entorno o el valor por defecto si no está definida
 */
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
    .setTitle('KanBase API')
    .setDescription('Documentación de la API de KanBase')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}

/**
 * Función principal para arrancar la aplicación NestJS. Configura CORS, seguridad, validación y Swagger.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

  await app.listen(3000, '0.0.0.0'); // Escuchar en todas las interfaces para permitir conexiones desde otros contenedores
}

void bootstrap();
