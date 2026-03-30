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

// Importamos ValidatedRequest exactamente igual que en users.controller.ts
import type { ValidatedRequest } from '../auth/interfaces/jwt-payload.interface';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';

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
    // Extraemos directamente el 'sub' que sabemos que es el ID del JWT
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
}
