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
import { BoardsPermissionsService } from './boards-permissions.service';
import { BoardsMembersService } from './boards-members.service';
import { BoardsColumnsService } from './boards-columns.service';
import { BoardsSprintsService } from './boards-sprints.service';
import { BoardsCoreService } from './boards-core.service';
import { BoardsQueryService } from './boards-query.service';

/**
 * Modulo de tableros
 */
@Module({
  imports: [
    // Carga schemas del modulo
    MongooseModule.forFeature([
      { name: Board.name, schema: BoardSchema },
      { name: Task.name, schema: TaskSchema },
      { name: BoardActivityLog.name, schema: BoardActivityLogSchema },
    ]),
    // Usa CASL para permisos
    CaslModule,
    // Usa users para datos de miembros
    UsersModule,
    // Usa notificaciones para avisos
    NotificationsModule,
  ],
  controllers: [BoardsController],
  providers: [
    BoardsService,
    BoardPolicyGuard,
    BoardActivityService,
    BoardsPermissionsService,
    BoardsMembersService,
    BoardsColumnsService,
    BoardsSprintsService,
    BoardsCoreService,
    BoardsQueryService,
  ],
  exports: [
    BoardsService,
    BoardPolicyGuard,
    BoardActivityService,
    BoardsPermissionsService,
    BoardsMembersService,
    BoardsColumnsService,
    BoardsSprintsService,
    BoardsCoreService,
    BoardsQueryService,
  ],
})
export class BoardsModule {}
