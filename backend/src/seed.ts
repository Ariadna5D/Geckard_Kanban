import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from './app.module';
import { Board } from './boards/schemas/board.schema';
import { Task } from './tasks/schemas/task.schema';
import { User } from './users/schemas/user.schema';
import { seedFreeBoard, seedMainBoard, seedProBoard } from './seed/board-seeds';
import { removePreviousDemoBoards, upsertDemoUsers } from './seed/helpers';

const seedLogger = new Logger('SeedScript');

/**
 * Crea datos demo
 */
async function bootstrap(): Promise<void> {
  seedLogger.log('Iniciando seed demo');

  // Levantar contexto Nest sin abrir servidor http
  const application = await NestFactory.createApplicationContext(AppModule);
  const userModel = application.get<Model<User>>(getModelToken(User.name));
  const boardModel = application.get<Model<Board>>(getModelToken(Board.name));
  const taskModel = application.get<Model<Task>>(getModelToken(Task.name));

  try {
    // Limpiar demo anterior para evitar duplicados
    await removePreviousDemoBoards(boardModel, taskModel);
    // Crear o actualizar usuarios demo
    const userIdByEmail = await upsertDemoUsers(userModel);

    // Crear tableros y tareas de muestra
    await seedMainBoard({ boardModel, taskModel, userIdByEmail });
    await seedFreeBoard({ boardModel, taskModel, userIdByEmail });
    await seedProBoard({ boardModel, taskModel, userIdByEmail });

    seedLogger.log('Seed completado');
  } catch (error) {
    seedLogger.error('Error en seed.', error as Error);
  } finally {
    // Cerrar contexto para no dejar proceso colgado
    await application.close();
    process.exit(0);
  }
}

void bootstrap();
