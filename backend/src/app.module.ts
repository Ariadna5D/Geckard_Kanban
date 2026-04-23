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

// Opciones de conexión a Mongo (usuario, contraseña y host desde variables de entorno).
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

  /** Por defecto `localhost`: seed y `nest start` en tu PC. Docker Compose inyecta `MONGO_HOST=mongodb`. */
  let mongoHost = 'localhost';
  if (mongoHostRaw !== undefined && mongoHostRaw !== null) {
    const mongoHostCandidate = mongoHostRaw.trim();
    if (mongoHostCandidate !== '') {
      mongoHost = mongoHostCandidate;
    }
  }

  if (user === '' || pass === '') {
    throw new Error(
      'MONGO_USERNAME y MONGO_PASSWORD son obligatorias para MongoDB.',
    );
  }

  return {
    uri:
      'mongodb://' +
      mongoHost +
      ':27017/' +
      encodeURIComponent(dbName),
    user,
    pass,
    authSource: 'admin',
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Raíz del monorepo (.env) o carpeta backend (.env) al ejecutar nest desde ahí.
      envFilePath: ['.env', '../.env'],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createMongooseOptions,
    }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
