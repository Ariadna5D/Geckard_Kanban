import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TasksModule } from './tasks/tasks.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CaslModule } from './casl/casl.module';
import { BoardsModule } from './boards/boards.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { BillingModule } from './billing/billing.module';
import { NotificationsModule } from './notifications/notifications.module';

/**
 * Prepara opciones de conexion a mongodb
 */
function createMongooseOptions(configService: ConfigService) {
  const userRaw = configService.get<string>('MONGO_USERNAME');
  const passRaw = configService.get<string>('MONGO_PASSWORD');
  const dbNameRaw = configService.get<string>('MONGO_DATABASE');
  const mongoHostRaw = configService.get<string>('MONGO_HOST');

  let user = '';
  if (userRaw !== undefined && userRaw !== null) {
    user = userRaw.trim();
  }
  let pass = '';
  if (passRaw !== undefined && passRaw !== null) {
    pass = passRaw.trim();
  }

  let dbName = 'kanban_db';
  if (dbNameRaw !== undefined && dbNameRaw !== null) {
    const dbNameCandidate = dbNameRaw.trim();
    if (dbNameCandidate !== '') {
      dbName = dbNameCandidate;
    }
  }

  let mongoHost = 'localhost';
  const mongoHostDefined = mongoHostRaw !== undefined && mongoHostRaw !== null;
  const mongoHostCandidate = mongoHostDefined ? mongoHostRaw.trim() : '';
  if (mongoHostCandidate !== '') {
    mongoHost = mongoHostCandidate;
  } else if (mongoHostDefined && mongoHostCandidate === '') {
    const nodeEnv = (configService.get<string>('NODE_ENV') ?? '').trim();
    if (nodeEnv === 'production') {
      mongoHost = 'mongodb';
    }
  }

  if (user === '' || pass === '') {
    throw new Error('Falta configuracion de MongoDB.');
  }

  // Construye conexion principal que usa todo el backend
  return {
    uri: 'mongodb://' + mongoHost + ':27017/' + encodeURIComponent(dbName),
    user,
    pass,
    authSource: 'admin',
  };
}

/**
 * Modulo raiz
 */
@Module({
  imports: [
    // Carga .env para todos los modulos
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    // Conexion mongo central
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createMongooseOptions,
    }),
    // Limite simple por ip
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    TasksModule,
    AuthModule,
    UsersModule,
    CaslModule,
    BoardsModule,
    BillingModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
