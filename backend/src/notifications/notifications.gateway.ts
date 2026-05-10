import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

const NOTIFICATIONS_NAMESPACE = '/notifications';

@WebSocketGateway({
  namespace: NOTIFICATIONS_NAMESPACE,
  cors: {
    origin: true,
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private readonly socketUsers = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Genera nombre de sala para un usuario
   */
  private roomForUser(userId: string): string {
    return `notifications:user:${userId}`;
  }

  /**
   * Lee token del socket
   */
  private tokenFromSocket(client: Socket): string | null {
    // Intenta leer token desde auth del handshake
    const authUnknown: unknown = client.handshake.auth;
    if (
      authUnknown !== null &&
      typeof authUnknown === 'object' &&
      'token' in authUnknown
    ) {
      const tokenVal = (authUnknown as { token?: unknown }).token;
      if (typeof tokenVal === 'string' && tokenVal.trim() !== '') {
        return tokenVal.trim();
      }
    }

    const rawAuthorization = client.handshake.headers.authorization;
    if (typeof rawAuthorization !== 'string') {
      return null;
    }

    const trimmed = rawAuthorization.trim();
    if (!trimmed.toLowerCase().startsWith('bearer ')) {
      return null;
    }
    // Si viene en bearer devuelve token limpio
    return trimmed.slice('bearer '.length).trim();
  }

  /**
   * Valida token y conecta socket
   */
  handleConnection(client: Socket): void {
    const token = this.tokenFromSocket(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    const jwtSecretRaw = this.configService.get<string>('JWT_SECRET');
    let jwtSecret = '';
    if (jwtSecretRaw !== undefined && jwtSecretRaw !== null) {
      jwtSecret = jwtSecretRaw.trim();
    }
    if (jwtSecret === '') {
      this.logger.warn('JWT_SECRET vacio. Conexion rechazada.');
      client.disconnect(true);
      return;
    }

    try {
      // Verifica token y mete el socket en sala del usuario
      const payload = this.jwtService.verify<{
        sub?: string;
      }>(token, { secret: jwtSecret });
      let userId = '';
      if (
        payload !== undefined &&
        payload !== null &&
        typeof payload.sub === 'string'
      ) {
        userId = payload.sub.trim();
      }
      if (userId === '') {
        client.disconnect(true);
        return;
      }
      this.socketUsers.set(client.id, userId);
      void client.join(this.roomForUser(userId));
    } catch {
      client.disconnect(true);
    }
  }

  /**
   * Elimina referencia del socket cuando se desconecta
   */
  handleDisconnect(client: Socket): void {
    this.socketUsers.delete(client.id);
  }

  /**
   * Emite evento de cambio para refrescar notificaciones del usuario
   */
  emitChangedForUser(userId: string): void {
    const targetUserId = userId.trim();
    if (targetUserId === '') return;
    // Emite evento simple para que front refresque bandeja
    this.server
      .to(this.roomForUser(targetUserId))
      .emit('notifications:changed', {
        at: new Date().toISOString(),
      });
  }
}
