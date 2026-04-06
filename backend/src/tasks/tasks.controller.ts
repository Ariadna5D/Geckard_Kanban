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
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Action } from 'src/casl/enums/action.enum';
import { Task } from './schemas/task.schema';
import { BoardPolicyGuard } from '../boards/board-policy.guard';
import {
  BoardIdFrom,
  BoardIdSource,
  CheckBoardPolicies,
} from '../boards/board-policy.decorator';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { ValidatedRequest } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /** Crea una tarea dentro de un tablero/columna. */
  @Post()
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.BodyBoardId)
  @CheckBoardPolicies((ability) => ability.can(Action.Create, Task))
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

  /** Lista tareas de un tablero si el usuario tiene acceso. */
  @Get('board/:boardId')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamBoardId)
  @CheckBoardPolicies((ability) => ability.can(Action.Read, Task))
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

  /** Actualiza campos básicos de la tarea (no posición). */
  @Patch(':id')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.TaskParamId)
  @CheckBoardPolicies((ability) => ability.can(Action.Update, Task))
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

  /** Reubica tarea por drag & drop (columna y order). */
  @Patch(':id/position')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.TaskParamId)
  @CheckBoardPolicies((ability) => ability.can(Action.Update, Task))
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

  /** Elimina una tarea por id. */
  @Delete(':id')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.TaskParamId)
  @CheckBoardPolicies((ability) => ability.can(Action.Delete, Task))
  @ApiOperation({ summary: 'Eliminar una tarea' })
  @ApiResponse({ status: 204, description: 'Tarea fulminada.' })
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
}
