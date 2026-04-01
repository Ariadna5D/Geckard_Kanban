import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors(); // Habilitamos CORS para permitir solicitudes desde el frontend
  app.setGlobalPrefix('api'); // Añadimos un prefijo global "api" para todas las rutas, por ejemplo: /api/users/me
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina propiedades no definidas en los DTOs
      forbidNonWhitelisted: true, // Lanza un error si se envían propiedades no definidas
      transform: true, // Transforma los payloads a los tipos definidos en los DTOs automáticamente
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Kanban TFG API') // Título de la documentación
    .setDescription('Documentación de la API para el tablero Kanban gamificado') // Descripción de la API
    .setVersion('0.1') // Versión de la API
    .addBearerAuth() // Añade soporte para autenticación Bearer (JWT)
    .build();
  const document = SwaggerModule.createDocument(app, config); // Genera el documento Swagger a partir de los controladores y DTOs definidos
  SwaggerModule.setup('api/docs', app, document); // Ruta Swagger

  // Iniciamos la aplicación en el puerto 3000 y escuchando en todas las interfaces de red (
  await app.listen(3000, '0.0.0.0');
}
void bootstrap();
