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

  // CREAR TABLERO
  @Post()
  @UseGuards(PoliciesGuard)
  @CheckPolicies(canCreateBoard)
  @ApiOperation({ summary: 'Create a new board' })
  @ApiResponse({ status: 201, description: 'Board successfully created.' })
  create(
    @Body() createBoardDto: CreateBoardDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    return this.boardsService.create(
      createBoardDto,
      authenticatedRequest.user.sub,
    );
  }

  // LISTAR TABLEROS DEL USUARIO
  @Get()
  @UseGuards(PoliciesGuard)
  @CheckPolicies(canReadBoard)
  @ApiOperation({ summary: 'Get all boards for the authenticated user' })
  findAll(@Request() authenticatedRequest: ValidatedRequest) {
    return this.boardsService.findAll(authenticatedRequest.user.sub);
  }

  // ACTUALIZAR CONFIGURACIÓN DEL TABLERO
  @Patch(':id')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canUpdateBoardSettings)
  update(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateBoardDto: UpdateBoardDto,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    return this.boardsService.update(
      id.toString(),
      updateBoardDto,
      authenticatedRequest.user.sub,
      authenticatedRequest.user.role === 'admin',
    );
  }

  // ELIMINAR TABLERO
  @Delete(':id')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canDeleteBoard)
  remove(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    return this.boardsService.remove(
      id.toString(),
      authenticatedRequest.user.sub,
      authenticatedRequest.user.role === 'admin',
    );
  }

  // --- MIEMBROS E INVITACIONES ---

  // INVITAR A USUARIO
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
    return this.boardsService.inviteMember(
      id.toString(),
      dto,
      authenticatedRequest.user.sub,
      authenticatedRequest.user.role === 'admin',
    );
  }

  // LISTAR MIEMBROS DEL TABLERO
  @Get(':id/members')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canReadBoard)
  @ApiOperation({ summary: 'Listar miembros del tablero (con perfil)' })
  listMembers(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    return this.boardsService.listMembers(
      id.toString(),
      authenticatedRequest.user.sub,
      authenticatedRequest.user.role === 'admin',
    );
  }

  // ELIMINAR MIEMBRO DEL TABLERO
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

  // ABANDONAR TABLERO (mi propio usuario)
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

  // --- COLUMNAS ---

  // CREAR COLUMNA
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
    return this.boardsService.addColumn(
      boardId,
      createColumnDto,
      authenticatedRequest.user.sub,
      authenticatedRequest.user.role === 'admin',
    );
  }

  // EDITAR TÍTULO DE COLUMNA
  @Patch(':id/columns/:columnId')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({ summary: 'Editar título de una columna' })
  updateColumn(
    @Param('id') boardId: string,
    @Param('columnId') columnId: string,
    @Body('title') title: string,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    return this.boardsService.updateColumn(
      boardId,
      columnId,
      title,
      authenticatedRequest.user.sub,
      authenticatedRequest.user.role === 'admin',
    );
  }

  // BORRAR COLUMNA
  @Delete(':id/columns/:columnId')
  @UseGuards(BoardPolicyGuard)
  @BoardIdFrom(BoardIdSource.ParamId)
  @CheckBoardPolicies(canEditBoardColumns)
  @ApiOperation({ summary: 'Eliminar una columna y sus tareas (Cascada)' })
  removeColumn(
    @Param('id') boardId: string,
    @Param('columnId') columnId: string,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    return this.boardsService.removeColumn(
      boardId,
      columnId,
      authenticatedRequest.user.sub,
      authenticatedRequest.user.role === 'admin',
    );
  }

  // POSICION COLUMNA
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
    return this.boardsService.updateColumnPosition(
      boardId,
      columnId,
      order,
      authenticatedRequest.user.sub,
      authenticatedRequest.user.role === 'admin',
    );
  }

  // OBTENER TABLERO POR SLUG
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
}
