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

@Module({
  imports: [
    // Carga de variables entorno
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      envFilePath: '.env',
    }),

    // Conexión a MongoDB con credenciales desde variables de entorno
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const user = configService.get<string>('MONGO_USERNAME');
        const pass = configService.get<string>('MONGO_PASSWORD');
        const dbName =
          configService.get<string>('MONGO_DATABASE')?.trim() || 'kanban_db';

        const uri = `mongodb://${user}:${pass}@mongodb:27017/${dbName}?authSource=admin`;
        return { uri };
      },
    }),
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
