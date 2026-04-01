// src/boards/boards.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';
import { BoardPolicyGuard } from './board-policy.guard';
import { Board, BoardSchema } from './schemas/board.schema';
import { CaslModule } from '../casl/casl.module';
import { Task, TaskSchema } from 'src/tasks/schemas/task.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Board.name, schema: BoardSchema },
      { name: Task.name, schema: TaskSchema },
    ]),
    CaslModule,
    UsersModule,
  ],
  controllers: [BoardsController],
  providers: [BoardsService, BoardPolicyGuard],
  exports: [BoardsService, BoardPolicyGuard],
})
export class BoardsModule {}
