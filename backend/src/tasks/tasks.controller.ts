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
  constructor(private readonly tasksService: TasksService) {}

  /**
   * Crea una tarjeta en la columna indicada del tablero.
   */
  @Post()
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.BodyBoardId)
  @CheckBoardPolicies(canCreateTask)
  @ApiOperation({ summary: 'Crear una nueva tarea en una columna' })
  @ApiResponse({ status: 201, description: 'Tarea creada con éxito.' })
  create(
    @Body() createTaskDto: CreateTaskDto,
    @Request() req: ValidatedRequest,
  ) {
    return this.tasksService.create(
      createTaskDto,
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Devuelve todas las tareas de un tablero (para pintar el Kanban).
   */
  @Get('board/:boardId')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamBoardId)
  @CheckBoardPolicies(canReadTask)
  @ApiOperation({ summary: 'Obtener todas las tareas de un tablero' })
  @ApiParam({ name: 'boardId', type: 'string', description: 'ID del tablero' })
  findAllByBoard(
    @Param('boardId', ParseObjectIdPipe) boardId: Types.ObjectId,
    @Request() req: ValidatedRequest,
  ) {
    return this.tasksService.findAllByBoard(
      boardId.toString(),
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Devuelve solo tareas archivadas del tablero (panel de archivo).
   */
  @Get('board/:boardId/archived')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamBoardId)
  @CheckBoardPolicies(canReadTask)
  @ApiOperation({ summary: 'Obtener tareas archivadas de un tablero' })
  @ApiParam({ name: 'boardId', type: 'string', description: 'ID del tablero' })
  findArchivedByBoard(
    @Param('boardId', ParseObjectIdPipe) boardId: Types.ObjectId,
    @Request() req: ValidatedRequest,
  ) {
    return this.tasksService.findArchivedByBoard(
      boardId.toString(),
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Cambia título, descripción, prioridad, etc. (no mueve de columna).
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
    @Request() req: ValidatedRequest,
  ) {
    return this.tasksService.update(
      id.toString(),
      updateTaskDto,
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Mueve la tarjeta a otra columna o reordena dentro de la misma (arrastrar y soltar).
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
    @Request() req: ValidatedRequest,
  ) {
    return this.tasksService.updatePosition(
      id.toString(),
      positionDto.newColumnId,
      positionDto.newOrder,
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Archiva la tarjeta (sale del tablero principal, pero se puede restaurar).
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
    @Request() req: ValidatedRequest,
  ) {
    return this.tasksService.remove(
      id.toString(),
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Restaura una tarea archivada para volver a verla en el tablero.
   */
  @Patch(':id/restore')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.TaskParamId)
  @CheckBoardPolicies(canUpdateTask)
  @ApiOperation({ summary: 'Restaurar una tarea archivada' })
  @ApiParam({ name: 'id', type: 'string', description: 'ID de la tarea' })
  restore(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() req: ValidatedRequest,
  ) {
    return this.tasksService.restore(
      id.toString(),
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Borra definitivamente una tarea archivada (admin/owner del tablero).
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
    @Request() req: ValidatedRequest,
  ) {
    return this.tasksService.purge(
      id.toString(),
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Lista quién votó qué y el número sugerido según la media del equipo.
   */
  @Get(':id/story-points')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.TaskParamId)
  @CheckBoardPolicies(canReadTask)
  getStoryPointVoting(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() req: ValidatedRequest,
  ) {
    return this.tasksService.getStoryPointVoting(
      id.toString(),
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Registra tu voto de story points (puedes cambiarlo cuando quieras).
   */
  @Patch(':id/story-points/vote')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.TaskParamId)
  @CheckBoardPolicies(canReadTask)
  async voteStoryPoints(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() body: StoryPointVoteDto,
    @Request() req: ValidatedRequest,
  ) {
    await this.tasksService.voteStoryPoints(
      id.toString(),
      req.user.sub,
      body.value,
      req.user.role === 'admin',
    );
  }
}
