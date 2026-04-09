import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Sprint, SprintSchema } from './schemas/sprint.schema';
import { SprintsService } from './sprints.service';
import { SprintsController } from './sprints.controller';
import { BoardsModule } from '../boards/boards.module';
import { CaslModule } from '../casl/casl.module';
import { Task, TaskSchema } from '../tasks/schemas/task.schema';

/**
 * Sprints por tablero (colección propia). Rutas bajo /boards/:boardId/sprints.
 * Se registra Task porque BoardPolicyGuard puede resolver boardId vía id de tarea en otros módulos.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sprint.name, schema: SprintSchema },
      { name: Task.name, schema: TaskSchema },
    ]),
    BoardsModule,
    CaslModule,
  ],
  controllers: [SprintsController],
  providers: [SprintsService],
  exports: [SprintsService, MongooseModule],
})
export class SprintsModule {}
