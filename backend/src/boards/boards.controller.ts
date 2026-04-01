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
import { Action } from '../casl/enums/action.enum';
import { Board } from './schemas/board.schema';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/policies.decorator';
import type { ValidatedRequest } from '../auth/interfaces/jwt-payload.interface';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { CreateColumnDto } from './dto/create-column.dto';

@ApiTags('Boards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  /**
   * Handles the creation of a new board.
   */
  @Post()
  @CheckPolicies((ability) => ability.can(Action.Create, Board))
  @ApiOperation({ summary: 'Create a new board' })
  @ApiResponse({ status: 201, description: 'Board successfully created.' })
  create(
    @Body() createBoardDto: CreateBoardDto,
    @Request() req: ValidatedRequest,
  ) {
    return this.boardsService.create(createBoardDto, req.user.sub);
  }

  /**
   * Retrieves all boards accessible by the authenticated user.
   */
  @Get()
  @CheckPolicies((ability) => ability.can(Action.Read, Board))
  @ApiOperation({ summary: 'Get all boards for the authenticated user' })
  findAll(@Request() req: ValidatedRequest) {
    return this.boardsService.findAll(req.user.sub);
  }

  /**
   * Updates basic information of a board (ObjectId en la URL).
   * Debe ir antes de GET by-slug para no competir con rutas dinámicas genéricas.
   */
  @Patch(':id')
  @CheckPolicies((ability) => ability.can(Action.Update, Board))
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
   * Deletes a board permanently (ObjectId en la URL).
   */
  @Delete(':id')
  @CheckPolicies((ability) => ability.can(Action.Delete, Board))
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

  // --- ENDPOINTS PARA COLUMNAS ---

  /**
   * Appends a new column to a specified board.
   */
  @Post(':id/columns')
  @CheckPolicies((ability) => ability.can(Action.Update, Board))
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
   * Updates the title of an existing column.
   */
  @Patch(':id/columns/:columnId')
  @CheckPolicies((ability) => ability.can(Action.Update, Board))
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
   * Deletes a column and initiates a cascade delete for all its tasks.
   */
  @Delete(':id/columns/:columnId')
  @CheckPolicies((ability) => ability.can(Action.Update, Board))
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
   * Actualiza la posición de una columna (arrastrar y soltar)
   */
  @Patch(':id/columns/:columnId/position')
  @CheckPolicies((ability) => ability.can(Action.Update, Board))
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
   * Tablero por slug (ruta explícita; evita colisión con PATCH/DELETE /boards/:id).
   */
  @Get('by-slug/:slug')
  @CheckPolicies((ability) => ability.can(Action.Read, Board))
  @ApiOperation({ summary: 'Get a specific board by slug' })
  findOneBySlug(@Param('slug') slug: string, @Request() req: ValidatedRequest) {
    return this.boardsService.findOneBySlug(slug, req.user.sub);
  }
}
