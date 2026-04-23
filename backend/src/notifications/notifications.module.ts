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

function createJwtModuleOptions(configService: ConfigService) {
  const secretRaw = configService.get<string>('JWT_SECRET');
  const secret = secretRaw?.trim() ?? '';
  if (secret === '') {
    throw new Error('JWT_SECRET es obligatoria para validar sockets.');
  }
  const eightHoursSeconds = 8 * 60 * 60;
  return {
    secret,
    signOptions: { expiresIn: eightHoursSeconds },
  };
}

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createJwtModuleOptions,
    }),
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
