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

@Module({
  imports: [
    // Variables de entorno globales para toda la app.
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      envFilePath: '.env',
    }),

    // Conexión MongoDB con credenciales por options (más robusto con caracteres especiales).
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const user = configService.get<string>('MONGO_USERNAME')?.trim();
        const pass = configService.get<string>('MONGO_PASSWORD')?.trim();
        const dbName =
          configService.get<string>('MONGO_DATABASE')?.trim() || 'kanban_db';

        if (!user || !pass) {
          throw new Error(
            'MONGO_USERNAME y MONGO_PASSWORD son obligatorias para MongoDB.',
          );
        }

        // user/pass fuera del URI: evita errores con @, :, # y similares.
        return {
          uri: `mongodb://mongodb:27017/${encodeURIComponent(dbName)}`,
          user,
          pass,
          authSource: 'admin',
        };
      },
    }),
    // Límite global básico; rutas críticas pueden sobrescribir con @Throttle.
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
