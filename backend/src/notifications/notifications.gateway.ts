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

  private roomForUser(userId: string): string {
    return `notifications:user:${userId}`;
  }

  private tokenFromSocket(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim() !== '') {
      return authToken.trim();
    }

    const rawAuthorization = client.handshake.headers.authorization;
    if (typeof rawAuthorization !== 'string') {
      return null;
    }

    const trimmed = rawAuthorization.trim();
    if (!trimmed.toLowerCase().startsWith('bearer ')) {
      return null;
    }
    return trimmed.slice('bearer '.length).trim();
  }

  handleConnection(client: Socket): void {
    const token = this.tokenFromSocket(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    const jwtSecret = this.configService.get<string>('JWT_SECRET')?.trim() ?? '';
    if (jwtSecret === '') {
      this.logger.warn('JWT_SECRET vacío: se rechaza conexión de notificaciones.');
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<{
        sub?: string;
      }>(token, { secret: jwtSecret });
      const userId = payload?.sub?.trim() ?? '';
      if (userId === '') {
        client.disconnect(true);
        return;
      }
      this.socketUsers.set(client.id, userId);
      client.join(this.roomForUser(userId));
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.socketUsers.delete(client.id);
  }

  emitChangedForUser(userId: string): void {
    const targetUserId = userId.trim();
    if (targetUserId === '') return;
    this.server.to(this.roomForUser(targetUserId)).emit('notifications:changed', {
      at: new Date().toISOString(),
    });
  }
}

