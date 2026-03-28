import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';

@Controller('boards')
@UseGuards(JwtAuthGuard)
export class BoardsController {
  // El constructor se declara solo una vez al principio
  constructor(private readonly boardsService: BoardsService) {}

  // Endpoint 1: Crear un tablero
  @Post()
  create(@Body() createBoardDto: CreateBoardDto, @Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.boardsService.create(createBoardDto, userId);
  }

  // Endpoint 2: Obtener todos los tableros del usuario
  @Get()
  findAll(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.boardsService.findAll(userId);
  }
}
