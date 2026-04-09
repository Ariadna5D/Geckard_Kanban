import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
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
import { SprintsService } from './sprints.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import {
  canReadBoard,
  canEditBoardColumns,
  canUpdateBoardSettings,
} from '../casl/named-policy.handlers';
import { ReorderSprintsDto } from './dto/reorder-sprints.dto';

@ApiTags('Sprints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('boards/:boardId/sprints')
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Get()
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamBoardId)
  @CheckBoardPolicies(canReadBoard)
  @ApiOperation({ summary: 'Listar sprints del tablero' })
  @ApiParam({ name: 'boardId' })
  findByBoard(
    @Param('boardId', ParseObjectIdPipe) boardIdParam: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const boardIdString = boardIdParam.toString();
    const isApplicationAdmin = authenticatedRequest.user.role === 'admin';
    return this.sprintsService.findByBoard(
      boardIdString,
      authenticatedRequest.user.sub,
      isApplicationAdmin,
    );
  }

  @Post()
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamBoardId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({
    summary:
      'Crear sprint (activo; opcionalmente cierra sprints activos previos)',
  })
  create(
    @Param('boardId', ParseObjectIdPipe) boardId: Types.ObjectId,
    @Body() dto: CreateSprintDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isApplicationAdmin = authenticatedRequest.user.role === 'admin';
    return this.sprintsService.create(
      boardId.toString(),
      dto,
      authenticatedRequest.user.sub,
      isApplicationAdmin,
    );
  }

  @Patch('reorder')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamBoardId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({ summary: 'Ordenar sprints en el desplegable del tablero' })
  reorder(
    @Param('boardId', ParseObjectIdPipe) boardId: Types.ObjectId,
    @Body() dto: ReorderSprintsDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isApplicationAdmin = authenticatedRequest.user.role === 'admin';
    return this.sprintsService.reorder(
      boardId.toString(),
      dto.sprintIds,
      authenticatedRequest.user.sub,
      isApplicationAdmin,
    );
  }

  @Patch(':sprintId/complete')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamBoardId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({ summary: 'Cerrar sprint (estado completed)' })
  complete(
    @Param('boardId', ParseObjectIdPipe) boardId: Types.ObjectId,
    @Param('sprintId', ParseObjectIdPipe) sprintId: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isApplicationAdmin = authenticatedRequest.user.role === 'admin';
    return this.sprintsService.complete(
      boardId.toString(),
      sprintId.toString(),
      authenticatedRequest.user.sub,
      isApplicationAdmin,
    );
  }

  @Patch(':sprintId/set-active')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamBoardId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({
    summary:
      'Dejar un único sprint activo (no reabre cerrados; usar reopen con permiso admin)',
  })
  setActive(
    @Param('boardId', ParseObjectIdPipe) boardId: Types.ObjectId,
    @Param('sprintId', ParseObjectIdPipe) sprintId: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isApplicationAdmin = authenticatedRequest.user.role === 'admin';
    return this.sprintsService.setActive(
      boardId.toString(),
      sprintId.toString(),
      authenticatedRequest.user.sub,
      isApplicationAdmin,
    );
  }

  @Patch(':sprintId/reopen')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamBoardId)
  @CheckBoardPolicies(canUpdateBoardSettings)
  @ApiOperation({
    summary: 'Reabrir sprint cerrado (admin del tablero o superior)',
  })
  reopen(
    @Param('boardId', ParseObjectIdPipe) boardId: Types.ObjectId,
    @Param('sprintId', ParseObjectIdPipe) sprintId: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isApplicationAdmin = authenticatedRequest.user.role === 'admin';
    return this.sprintsService.reopen(
      boardId.toString(),
      sprintId.toString(),
      authenticatedRequest.user.sub,
      isApplicationAdmin,
    );
  }

  @Delete(':sprintId')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamBoardId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({ summary: 'Eliminar sprint (tareas pasan a backlog)' })
  remove(
    @Param('boardId', ParseObjectIdPipe) boardId: Types.ObjectId,
    @Param('sprintId', ParseObjectIdPipe) sprintId: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isApplicationAdmin = authenticatedRequest.user.role === 'admin';
    return this.sprintsService.remove(
      boardId.toString(),
      sprintId.toString(),
      authenticatedRequest.user.sub,
      isApplicationAdmin,
    );
  }
}
