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

  @Get()
  @CheckPolicies((ability) => ability.can(Action.Read, Board))
  @ApiOperation({ summary: 'Get all boards for the authenticated user' })
  findAll(@Request() req: ValidatedRequest) {
    return this.boardsService.findAll(req.user.sub);
  }

  @Get(':slug')
  @CheckPolicies((ability) => ability.can(Action.Read, Board))
  @ApiOperation({ summary: 'Get a specific board by slug' })
  findOne(@Param('slug') slug: string, @Request() req: ValidatedRequest) {
    return this.boardsService.findOneBySlug(slug, req.user.sub);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can(Action.Update, Board))
  update(
    // Inyectamos el Pipe nativo aquí
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateBoardDto: UpdateBoardDto,
    @Request() req: ValidatedRequest,
  ) {
    // Al servicio le seguimos pasando el string para mantener su firma intacta
    return this.boardsService.update(
      id.toString(),
      updateBoardDto,
      req.user.sub,
    );
  }

  @Delete(':id')
  @CheckPolicies((ability) => ability.can(Action.Delete, Board))
  remove(
    // Y aquí igual
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() req: ValidatedRequest,
  ) {
    return this.boardsService.remove(id.toString(), req.user.sub);
  }

  // --- ENDPOINTS PARA COLUMNAS ---

  @Post(':id/columns')
  @CheckPolicies((ability) => ability.can(Action.Update, Board))
  @ApiOperation({ summary: 'Añadir una columna al tablero' })
  addColumn(
    @Param('id') boardId: string,
    @Body() createColumnDto: CreateColumnDto,
  ) {
    return this.boardsService.addColumn(boardId, createColumnDto);
  }

  @Patch(':id/columns/:columnId')
  @CheckPolicies((ability) => ability.can(Action.Update, Board))
  @ApiOperation({ summary: 'Editar título de una columna' })
  updateColumn(
    @Param('id') boardId: string,
    @Param('columnId') columnId: string,
    @Body('title') title: string,
  ) {
    return this.boardsService.updateColumn(boardId, columnId, title);
  }

  @Delete(':id/columns/:columnId')
  @CheckPolicies((ability) => ability.can(Action.Update, Board))
  @ApiOperation({ summary: 'Eliminar una columna' })
  removeColumn(
    @Param('id') boardId: string,
    @Param('columnId') columnId: string,
  ) {
    return this.boardsService.removeColumn(boardId, columnId);
  }
}
