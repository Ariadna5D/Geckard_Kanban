import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';
import { BoardPolicyGuard } from './board-policy.guard';
import { Board, BoardSchema } from './schemas/board.schema';
import {
  BoardActivityLog,
  BoardActivityLogSchema,
} from './schemas/board-activity-log.schema';
import { CaslModule } from '../casl/casl.module';
import { Task, TaskSchema } from '../tasks/schemas/task.schema';
import { UsersModule } from '../users/users.module';
import { BoardActivityService } from './board-activity.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Board.name, schema: BoardSchema },
      { name: Task.name, schema: TaskSchema },
      { name: BoardActivityLog.name, schema: BoardActivityLogSchema },
    ]),
    CaslModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [BoardsController],
  providers: [BoardsService, BoardPolicyGuard, BoardActivityService],
  exports: [BoardsService, BoardPolicyGuard, BoardActivityService],
})
export class BoardsModule {}
