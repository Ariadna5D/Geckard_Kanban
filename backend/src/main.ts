import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. TUS AJUSTES CLAVE (CORS y Prefijo)
  app.enableCors();
  app.setGlobalPrefix('api');

  // 2. EL GUARDIA DE SEGURIDAD GLOBAL (Mejorado)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // si el usuario mete un campo que no existe en el DTO, lo omite
      forbidNonWhitelisted: true, // además manda error si no coinciden los campos, como el whitelist, pero lanza error
      transform: true, // pasa el JSON a objeto
    }),
  );

  // 3. LA DOCUMENTACIÓN AUTOMÁTICA (Swagger)
  const config = new DocumentBuilder()
    .setTitle('Kanban TFG API')
    .setDescription('Documentación de la API para el tablero Kanban gamificado')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  // OJO AQUÍ: Como tu prefijo es 'api', he movido Swagger a 'api/docs' para que no choquen
  SwaggerModule.setup('api/docs', app, document);

  // 4. ARRANQUE DEL SERVIDOR (Con 0.0.0.0 para Docker)
  await app.listen(3000, '0.0.0.0');
}
bootstrap();
