import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task, TaskSchema } from './schemas/task.schema';
import { CaslModule } from '../casl/casl.module';
import { BoardsModule } from '../boards/boards.module';

/**
 * Modulo de tareas
 */
@Module({
  imports: [
    // Carga schema de tarea
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
    // Usa CASL para permisos
    CaslModule,
    // Usa boards para validaciones
    BoardsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
