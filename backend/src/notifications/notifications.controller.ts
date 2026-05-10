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
  /**
   * Inyecta el servicio de notificaciones del usuario
   */
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Lista notificaciones del usuario autenticado
   */
  @Get()
  @ApiOperation({ summary: 'Lista notificaciones del usuario autenticado' })
  listMine(
    @Request() authenticatedRequest: ValidatedRequest,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    // Devuelve solo notificaciones del usuario logueado
    let data = 40;
    if (limit !== undefined) {
      data = limit;
    }
    return this.notificationsService.listForUser(
      authenticatedRequest.user.sub,
      data,
    );
  }

  /**
   * Devuelve contador de no leidas
   */
  @Get('unread-count')
  @ApiOperation({ summary: 'Cuenta de notificaciones no leídas' })
  async unreadCount(@Request() authenticatedRequest: ValidatedRequest) {
    // Cuenta no leidas solo del usuario actual
    const count = await this.notificationsService.unreadCount(
      authenticatedRequest.user.sub,
    );
    return { count };
  }

  /**
   * Marca una notificacion como leida
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  async markAsRead(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    // Marca una notificacion y valida propietario
    await this.notificationsService.markAsRead(
      id.toString(),
      authenticatedRequest.user.sub,
    );
  }

  /**
   * Acepta una invitacion de tablero
   */
  @Post(':id/accept')
  @ApiOperation({ summary: 'Aceptar invitación de tablero' })
  async acceptBoardInvite(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    // Acepta invitacion pendiente del usuario
    await this.notificationsService.acceptBoardInvite(
      id.toString(),
      authenticatedRequest.user.sub,
    );
  }

  /**
   * Rechaza una invitacion de tablero
   */
  @Post(':id/reject')
  @ApiOperation({ summary: 'Rechazar invitación de tablero' })
  async rejectBoardInvite(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Request() authenticatedRequest: ValidatedRequest,
  ) {
    // Rechaza invitacion para cerrar el flujo
    await this.notificationsService.rejectBoardInvite(
      id.toString(),
      authenticatedRequest.user.sub,
    );
  }
}
