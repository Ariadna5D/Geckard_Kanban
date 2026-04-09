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
import { SprintsModule } from './sprints/sprints.module';
import { ThrottlerModule } from '@nestjs/throttler';

/**
 *  Crea las opciones de conexión para Mongoose utilizando las variables de entorno.
 * @param configService  El servicio de configuración para acceder a las variables de entorno.
 * @returns  Un objeto con las opciones de conexión para Mongoose.
 */
function createMongooseOptions(configService: ConfigService) {
  const userRaw = configService.get<string>('MONGO_USERNAME');
  const passRaw = configService.get<string>('MONGO_PASSWORD');
  const dbNameRaw = configService.get<string>('MONGO_DATABASE');

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
    const t = dbNameRaw.trim();
    if (t !== '') {
      dbName = t;
    }
  }

  if (user === '' || pass === '') {
    throw new Error(
      'MONGO_USERNAME y MONGO_PASSWORD son obligatorias para MongoDB.',
    );
  }

  return {
    uri: 'mongodb://mongodb:27017/' + encodeURIComponent(dbName),
    user,
    pass,
    authSource: 'admin',
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      envFilePath: '.env',
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
    SprintsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
