import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task, TaskSchema } from './schemas/task.schema';
import { CaslModule } from '../casl/casl.module';
import { BoardsModule } from '../boards/boards.module';
import { SprintsModule } from '../sprints/sprints.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
    CaslModule,
    BoardsModule,
    SprintsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
