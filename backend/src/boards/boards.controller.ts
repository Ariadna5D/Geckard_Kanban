import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  Request,
  Param,
  HttpCode,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import { BoardPolicyGuard } from './board-policy.guard';
import {
  BoardIdFrom,
  BoardIdSource,
  CheckBoardPolicies,
} from './board-policy.decorator';
import type { ValidatedRequest } from '../auth/interfaces/jwt-payload.interface';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { CreateColumnDto } from './dto/create-column.dto';
import { InviteBoardMemberDto } from './dto/invite-board-member.dto';
import { UpdateColumnBodyDto } from './dto/update-column-body.dto';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateActiveSprintDto } from './dto/update-active-sprint.dto';
import { UpdateClosedSprintDto } from './dto/update-closed-sprint.dto';
import {
  canCreateBoard,
  canReadBoard,
  canUpdateBoardSettings,
  canDeleteBoard,
  canManageBoardMembers,
  canEditBoardColumns,
} from '../casl/named-policy.handlers';

@ApiTags('Boards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('boards')
export class BoardsController {
  /**
   * Inyecta servicio de tableros para operaciones de dominio
   */
  constructor(private readonly boardsService: BoardsService) {}

  /**
   * Crea un tablero nuevo para el usuario autenticado
   */
  @Post()
  @UseGuards(PoliciesGuard)
  @CheckPolicies(canCreateBoard)
  @ApiOperation({ summary: 'Create a new board' })
  @ApiResponse({ status: 201, description: 'Board successfully created.' })
  create(
    @Body() createBoardDto: CreateBoardDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    // Pasa el usuario autenticado para crear el tablero a su nombre
    return this.boardsService.create(
      createBoardDto,
      authenticatedRequest.user.sub,
    );
  }

  /**
   * Lista tableros visibles para el usuario autenticado
   */
  @Get()
  @UseGuards(PoliciesGuard)
  @CheckPolicies(canReadBoard)
  @ApiOperation({ summary: 'Get all boards for the authenticated user' })
  findAll(@Request() authenticatedRequest: ValidatedRequest) {
    // Lista tableros visibles para el usuario autenticado
    return this.boardsService.findAll(authenticatedRequest.user.sub);
  }

  /**
   * Actualiza datos principales del tablero
   */
  @Patch(':id')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canUpdateBoardSettings)
  update(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateBoardDto: UpdateBoardDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    // El guard ya reviso permisos y aqui solo delegamos al servicio
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.update(
      id.toString(),
      updateBoardDto,
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Elimina un tablero y su contenido asociado
   */
  @Delete(':id')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canDeleteBoard)
  remove(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    // Elimina tablero solo si el rol cumple la politica de borrado
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.remove(
      id.toString(),
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Invita o actualiza rol de un miembro en el tablero
   */
  @Post(':id/members')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canManageBoardMembers)
  @ApiOperation({ summary: 'Invitar o actualizar miembro del tablero' })
  inviteMember(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: InviteBoardMemberDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    // Esta ruta sirve para invitar o para cambiar rol de un miembro
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.inviteMember(
      id.toString(),
      dto,
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Lista miembros del tablero con datos de perfil
   */
  @Get(':id/members')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canReadBoard)
  @ApiOperation({ summary: 'Listar miembros del tablero (con perfil)' })
  listMembers(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    // Prepara rol admin para dejar el flujo mas claro
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.listMembers(
      id.toString(),
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Expulsa un miembro del tablero
   */
  @Delete(':id/members/:memberUserId')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canManageBoardMembers)
  @ApiOperation({ summary: 'Expulsar miembro del tablero' })
  @HttpCode(204)
  async removeMember(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Param('memberUserId', ParseObjectIdPipe) memberUserId: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    await this.boardsService.removeMember(
      id.toString(),
      memberUserId.toString(),
      authenticatedRequest.user.sub,
      authenticatedRequest.user.role === 'admin',
    );
  }

  /**
   * Permite que el usuario autenticado abandone el tablero
   */
  @Delete(':id/leave')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canReadBoard)
  @ApiOperation({ summary: 'Abandonar tablero (usuario actual)' })
  @HttpCode(204)
  async leaveBoard(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    await this.boardsService.leaveBoard(
      id.toString(),
      authenticatedRequest.user.sub,
      authenticatedRequest.user.role === 'admin',
    );
  }

  /**
   * Crea una columna nueva en el tablero
   */
  @Post(':id/columns')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({ summary: 'Añadir una columna al tablero' })
  addColumn(
    @Param('id') boardId: string,
    @Body() createColumnDto: CreateColumnDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.addColumn(
      boardId,
      createColumnDto,
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Archiva columna y sus tareas activas
   */
  @Patch(':id/columns/:columnId/archive')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({ summary: 'Archivar columna y sus tareas activas' })
  archiveColumn(
    @Param('id') boardId: string,
    @Param('columnId') columnId: string,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.archiveColumn(
      boardId,
      columnId,
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Restaura una columna archivada
   */
  @Patch(':id/columns/:columnId/restore')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({ summary: 'Restaurar columna archivada y tareas vinculadas' })
  restoreColumn(
    @Param('id') boardId: string,
    @Param('columnId') columnId: string,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.restoreColumn(
      boardId,
      columnId,
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Actualiza titulo o tipo de una columna
   */
  @Patch(':id/columns/:columnId')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({ summary: 'Editar título de una columna' })
  updateColumn(
    @Param('id') boardId: string,
    @Param('columnId') columnId: string,
    @Body() body: UpdateColumnBodyDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.updateColumn(
      boardId,
      columnId,
      body,
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Elimina columna archivada de forma permanente
   */
  @Delete(':id/columns/:columnId')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({
    summary:
      'Eliminar definitivamente una columna ya archivada y todas sus tareas',
  })
  removeColumn(
    @Param('id') boardId: string,
    @Param('columnId') columnId: string,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.removeColumn(
      boardId,
      columnId,
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Crea sprint activo cuando el tablero lo permite
   */
  @Post(':id/sprints')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({
    summary: 'Create active sprint (sprints must be enabled on the board)',
  })
  createSprint(
    @Param('id') boardId: string,
    @Body() createSprintDto: CreateSprintDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.createSprint(
      boardId,
      createSprintDto,
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Cierra sprint activo y guarda snapshot historico
   */
  @Post(':id/sprints/:sprintId/close')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({ summary: 'Close active sprint and store a frozen snapshot' })
  closeSprint(
    @Param('id') boardId: string,
    @Param('sprintId') sprintId: string,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.closeSprint(
      boardId,
      sprintId,
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Renombra sprint del historial de cerrados
   */
  @Patch(':id/sprints/history/:sprintId')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canUpdateBoardSettings)
  @ApiOperation({ summary: 'Rename a sprint in closed history' })
  updateClosedSprintRecord(
    @Param('id') boardId: string,
    @Param('sprintId') sprintId: string,
    @Body() body: UpdateClosedSprintDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.updateClosedSprintRecord(
      boardId,
      sprintId,
      body,
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Elimina sprint del historial de cerrados
   */
  @Delete(':id/sprints/history/:sprintId')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canUpdateBoardSettings)
  @ApiOperation({ summary: 'Remove one sprint from closed history' })
  deleteClosedSprintRecord(
    @Param('id') boardId: string,
    @Param('sprintId') sprintId: string,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.deleteClosedSprintRecord(
      boardId,
      sprintId,
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Actualiza datos del sprint activo
   */
  @Patch(':id/sprints/:sprintId')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({ summary: 'Update active sprint name or planned dates' })
  updateActiveSprint(
    @Param('id') boardId: string,
    @Param('sprintId') sprintId: string,
    @Body() body: UpdateActiveSprintDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.updateActiveSprint(
      boardId,
      sprintId,
      body,
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Cancela sprint activo sin guardar snapshot
   */
  @Delete(':id/sprints/:sprintId')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({
    summary: 'Cancel active sprint (no snapshot; tasks lose sprint tag)',
  })
  cancelActiveSprint(
    @Param('id') boardId: string,
    @Param('sprintId') sprintId: string,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.cancelActiveSprint(
      boardId,
      sprintId,
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Guarda nuevo orden de una columna
   */
  @Patch(':id/columns/:columnId/position')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({ summary: 'Actualizar orden de la columna' })
  updateColumnPosition(
    @Param('id') boardId: string,
    @Param('columnId') columnId: string,
    @Body('order') order: string,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    const isAdmin = authenticatedRequest.user.role === 'admin';
    return this.boardsService.updateColumnPosition(
      boardId,
      columnId,
      order,
      authenticatedRequest.user.sub,
      isAdmin,
    );
  }

  /**
   * Busca tablero por slug
   */
  @Get('by-slug/:slug')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamSlug)
  @CheckBoardPolicies(canReadBoard)
  @ApiOperation({ summary: 'Get a specific board by slug' })
  findOneBySlug(
    @Param('slug') slug: string,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    return this.boardsService.findOneBySlug(
      slug,
      authenticatedRequest.user.sub,
    );
  }

  /**
   * Lista actividad reciente del tablero con limite
   */
  @Get(':id/activity')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canReadBoard)
  @ApiOperation({ summary: 'Listar actividad reciente del tablero' })
  getBoardActivity(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Query('limit') limitRaw: string | undefined,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    // Prepara rol admin para dejar el flujo mas claro
    const isAdmin = authenticatedRequest.user.role === 'admin';
    let limit = 60;
    if (limitRaw !== undefined) {
      // Intenta leer el limite desde query sin romper si llega texto raro
      const parsed = Number.parseInt(limitRaw, 10);
      if (!Number.isNaN(parsed)) {
        limit = parsed;
      }
    }
    return this.boardsService.listBoardActivity(
      id.toString(),
      authenticatedRequest.user.sub,
      isAdmin,
      limit,
    );
  }
}
