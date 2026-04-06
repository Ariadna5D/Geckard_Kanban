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
  constructor(private readonly boardsService: BoardsService) {}

  /**
   * Crea un tablero vacío; el usuario que llama queda como dueño.
   */
  @Post()
  @UseGuards(PoliciesGuard)
  @CheckPolicies(canCreateBoard)
  @ApiOperation({ summary: 'Create a new board' })
  @ApiResponse({ status: 201, description: 'Board successfully created.' })
  create(
    @Body() createBoardDto: CreateBoardDto,
    @Request() req: ValidatedRequest,
  ) {
    return this.boardsService.create(createBoardDto, req.user.sub);
  }

  /**
   * Lista los tableros en los que participas (propios o donde te invitaron).
   */
  @Get()
  @CheckPolicies(canReadBoard)
  @ApiOperation({ summary: 'Get all boards for the authenticated user' })
  findAll(@Request() req: ValidatedRequest) {
    return this.boardsService.findAll(req.user.sub);
  }

  /**
   * Cambia datos básicos del tablero (nombre, descripción…).
   */
  @Patch(':id')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canUpdateBoardSettings)
  update(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateBoardDto: UpdateBoardDto,
    @Request() req: ValidatedRequest,
  ) {
    return this.boardsService.update(
      id.toString(),
      updateBoardDto,
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Borra el tablero entero y sus tareas (solo con permisos fuertes).
   */
  @Delete(':id')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canDeleteBoard)
  remove(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() req: ValidatedRequest,
  ) {
    return this.boardsService.remove(
      id.toString(),
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  // --- MIEMBROS E INVITACIONES ---

  /**
   * Invita a alguien por id o le cambia el rol si ya estaba.
   */
  @Post(':id/members')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canManageBoardMembers)
  @ApiOperation({ summary: 'Invitar o actualizar miembro del tablero' })
  inviteMember(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: InviteBoardMemberDto,
    @Request() req: ValidatedRequest,
  ) {
    return this.boardsService.inviteMember(
      id.toString(),
      dto,
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Lista personas del tablero con nombre y avatar para la interfaz.
   */
  @Get(':id/members')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canReadBoard)
  @ApiOperation({ summary: 'Listar miembros del tablero (con perfil)' })
  listMembers(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() req: ValidatedRequest,
  ) {
    return this.boardsService.listMembers(
      id.toString(),
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Quita a un miembro del tablero (no al dueño).
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
    @Request() req: ValidatedRequest,
  ) {
    await this.boardsService.removeMember(
      id.toString(),
      memberUserId.toString(),
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  // --- COLUMNAS ---

  /**
   * Añade una columna nueva (título y posición inicial).
   */
  @Post(':id/columns')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({ summary: 'Añadir una columna al tablero' })
  addColumn(
    @Param('id') boardId: string,
    @Body() createColumnDto: CreateColumnDto,
    @Request() req: ValidatedRequest,
  ) {
    return this.boardsService.addColumn(
      boardId,
      createColumnDto,
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Renombra una columna existente.
   */
  @Patch(':id/columns/:columnId')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({ summary: 'Editar título de una columna' })
  updateColumn(
    @Param('id') boardId: string,
    @Param('columnId') columnId: string,
    @Body('title') title: string,
    @Request() req: ValidatedRequest,
  ) {
    return this.boardsService.updateColumn(
      boardId,
      columnId,
      title,
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Borra la columna y todas las tarjetas que llevaba dentro.
   */
  @Delete(':id/columns/:columnId')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({ summary: 'Eliminar una columna y sus tareas (Cascada)' })
  removeColumn(
    @Param('id') boardId: string,
    @Param('columnId') columnId: string,
    @Request() req: ValidatedRequest,
  ) {
    return this.boardsService.removeColumn(
      boardId,
      columnId,
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Guarda el orden al arrastrar columnas en el tablero.
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
    @Request() req: ValidatedRequest,
  ) {
    return this.boardsService.updateColumnPosition(
      boardId,
      columnId,
      order,
      req.user.sub,
      req.user.role === 'admin',
    );
  }

  /**
   * Carga un tablero por la parte amigable de la URL (el slug).
   */
  @Get('by-slug/:slug')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamSlug)
  @CheckBoardPolicies(canReadBoard)
  @ApiOperation({ summary: 'Get a specific board by slug' })
  findOneBySlug(@Param('slug') slug: string, @Request() req: ValidatedRequest) {
    return this.boardsService.findOneBySlug(slug, req.user.sub);
  }
}
