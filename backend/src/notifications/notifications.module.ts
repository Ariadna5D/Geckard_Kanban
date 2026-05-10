import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { Board, BoardSchema } from '../boards/schemas/board.schema';
import { NotificationsGateway } from './notifications.gateway';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

/**
 * Crea configuracion jwt para notificaciones
 */
function createJwtModuleOptions(configService: ConfigService) {
  const secretRaw = configService.get<string>('JWT_SECRET');
  let secret = '';
  if (secretRaw !== undefined && secretRaw !== null) {
    secret = secretRaw.trim();
  }
  if (secret === '') {
    throw new Error('JWT_SECRET es obligatoria.');
  }
  // Define tiempo de sesion del token
  const eightHoursSeconds = 8 * 60 * 60;
  return {
    secret,
    signOptions: { expiresIn: eightHoursSeconds },
  };
}

/**
 * Modulo de notificaciones
 */
@Module({
  imports: [
    ConfigModule,
    // JWT para autenticar websocket
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createJwtModuleOptions,
    }),
    // Guarda notificaciones en mongo
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: Board.name, schema: BoardSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService],
})
export class NotificationsModule {}
