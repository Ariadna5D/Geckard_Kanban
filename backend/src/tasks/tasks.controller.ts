import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskPositionDto } from './dto/update-task-position.dto';
import { StoryPointVoteDto } from './dto/story-point-vote.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BoardPolicyGuard } from '../boards/board-policy.guard';
import {
  BoardIdFrom,
  BoardIdSource,
  CheckBoardPolicies,
} from '../boards/board-policy.decorator';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { ValidatedRequest } from '../auth/interfaces/jwt-payload.interface';
import {
  canCreateTask,
  canReadTask,
  canUpdateTask,
  canDeleteTask,
} from '../casl/named-policy.handlers';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  /**
   * Inyecta el servicio de tareas para operaciones de tablero
   */
  constructor(private readonly tasksService: TasksService) {}

  /**
   * Crea una tarea nueva en el tablero indicado
   */
  @Post()
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.BodyBoardId)
  @CheckBoardPolicies(canCreateTask)
  @ApiOperation({ summary: 'Crear una nueva tarea en una columna' })
  @ApiResponse({ status: 201, description: 'Tarea creada con éxito.' })
  create(
    @Body() createTaskDto: CreateTaskDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    // Envia usuario y email para auditar quien crea la tarea
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.tasksService.create(
      createTaskDto,
      authenticatedRequest.user.sub,
      authenticatedRequest.user.email,
      isAdmin,
    );
  }

  /**
   * Lista tareas activas de un tablero
   */
  @Get('board/:boardId')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamBoardId)
  @CheckBoardPolicies(canReadTask)
  @ApiOperation({ summary: 'Obtener todas las tareas de un tablero' })
  @ApiParam({ name: 'boardId', type: 'string', description: 'ID del tablero' })
  findAllByBoard(
    @Param('boardId', ParseObjectIdPipe) boardId: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.tasksService.findAllByBoard(
      boardId.toString(),
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Lista tareas archivadas de un tablero
   */
  @Get('board/:boardId/archived')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamBoardId)
  @CheckBoardPolicies(canReadTask)
  @ApiOperation({ summary: 'Obtener tareas archivadas de un tablero' })
  @ApiParam({ name: 'boardId', type: 'string', description: 'ID del tablero' })
  findArchivedByBoard(
    @Param('boardId', ParseObjectIdPipe) boardId: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.tasksService.findArchivedByBoard(
      boardId.toString(),
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Actualiza campos editables de una tarea
   */
  @Patch(':id')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.TaskParamId)
  @CheckBoardPolicies(canUpdateTask)
  @ApiOperation({ summary: 'Actualizar datos básicos de la tarea' })
  @ApiParam({ name: 'id', type: 'string', description: 'ID de la tarea' })
  update(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateTaskDto: UpdateTaskDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    // Delega cambios con permisos ya validados por el guard de tablero
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.tasksService.update(
      id.toString(),
      updateTaskDto,
      authenticatedRequest.user.sub,
      authenticatedRequest.user.email,
      isAdmin,
    );
  }

  /**
   * Actualiza columna y orden para drag and drop
   */
  @Patch(':id/position')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.TaskParamId)
  @CheckBoardPolicies(canUpdateTask)
  @ApiOperation({ summary: 'Update task position (Drag & Drop)' })
  @ApiParam({ name: 'id', type: 'string', description: 'Task ID' })
  updatePosition(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() positionDto: UpdateTaskPositionDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    // Mueve tarea de columna y orden para reflejar drag and drop
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.tasksService.updatePosition(
      id.toString(),
      positionDto.newColumnId,
      positionDto.newOrder,
      authenticatedRequest.user.sub,
      authenticatedRequest.user.email,
      isAdmin,
    );
  }

  /**
   * Archiva una tarea activa
   */
  @Delete(':id')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.TaskParamId)
  @CheckBoardPolicies(canDeleteTask)
  @ApiOperation({ summary: 'Archivar una tarea' })
  @ApiResponse({ status: 204, description: 'Tarea archivada.' })
  @ApiParam({ name: 'id', type: 'string', description: 'ID de la tarea' })
  remove(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.tasksService.remove(
      id.toString(),
      authenticatedRequest.user.sub,
      authenticatedRequest.user.email,
      isAdmin,
    );
  }

  /**
   * Restaura una tarea archivada
   */
  @Patch(':id/restore')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.TaskParamId)
  @CheckBoardPolicies(canUpdateTask)
  @ApiOperation({ summary: 'Restaurar una tarea archivada' })
  @ApiParam({ name: 'id', type: 'string', description: 'ID de la tarea' })
  restore(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.tasksService.restore(
      id.toString(),
      authenticatedRequest.user.sub,
      authenticatedRequest.user.email,
      isAdmin,
    );
  }

  /**
   * Borra de forma permanente una tarea archivada
   */
  @Delete(':id/purge')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.TaskParamId)
  @CheckBoardPolicies(canDeleteTask)
  @ApiOperation({ summary: 'Borrar permanentemente una tarea archivada' })
  @ApiResponse({ status: 204, description: 'Tarea eliminada permanentemente.' })
  @ApiParam({ name: 'id', type: 'string', description: 'ID de la tarea' })
  purge(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.tasksService.purge(
      id.toString(),
      authenticatedRequest.user.sub,
      authenticatedRequest.user.email,
      isAdmin,
    );
  }

  /**
   * Devuelve estado de votacion de story points
   */
  @Get(':id/story-points')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.TaskParamId)
  @CheckBoardPolicies(canReadTask)
  getStoryPointVoting(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.tasksService.getStoryPointVoting(
      id.toString(),
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Guarda voto de story points del usuario actual
   */
  @Patch(':id/story-points/vote')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.TaskParamId)
  @CheckBoardPolicies(canReadTask)
  async voteStoryPoints(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() body: StoryPointVoteDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    // Guarda un solo voto por usuario para mantener recuento simple
    const isAdmin = authenticatedRequest.user.role === 'admin';
    await this.tasksService.voteStoryPoints(
      id.toString(),
      authenticatedRequest.user.sub,
      authenticatedRequest.user.email,
      body.value,
      isAdmin,
    );
  }

  /**
   * Quita el voto de story points del usuario actual
   */
  @Delete(':id/story-points/vote')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.TaskParamId)
  @CheckBoardPolicies(canReadTask)
  async clearStoryPointsVote(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    // Permite desmarcar voto cuando el usuario se equivoca al votar
    const isAdmin = authenticatedRequest.user.role === 'admin';
    await this.tasksService.clearStoryPointsVote(
      id.toString(),
      authenticatedRequest.user.sub,
      authenticatedRequest.user.email,
      isAdmin,
    );
  }
}
