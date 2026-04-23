import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { ValidatedRequest } from '../auth/interfaces/jwt-payload.interface';
import { NotificationsService } from './notifications.service';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista notificaciones del usuario autenticado' })
  listMine(
    @Request() req: ValidatedRequest,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.notificationsService.listForUser(req.user.sub, limit ?? 40);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Cuenta de notificaciones no leídas' })
  async unreadCount(@Request() req: ValidatedRequest) {
    const count = await this.notificationsService.unreadCount(req.user.sub);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  async markAsRead(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() req: ValidatedRequest,
  ) {
    await this.notificationsService.markAsRead(id.toString(), req.user.sub);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Aceptar invitación de tablero' })
  async acceptBoardInvite(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() req: ValidatedRequest,
  ) {
    await this.notificationsService.acceptBoardInvite(id.toString(), req.user.sub);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Rechazar invitación de tablero' })
  async rejectBoardInvite(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() req: ValidatedRequest,
  ) {
    await this.notificationsService.rejectBoardInvite(id.toString(), req.user.sub);
  }
}
