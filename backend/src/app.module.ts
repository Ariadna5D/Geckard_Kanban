import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TasksModule } from './tasks/tasks.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    // Carga de variables entorno
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
    }),

    // Conexión a MongoDB con credenciales desde variables de entorno
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const user = configService.get<string>('MONGO_USERNAME');
        const pass = configService.get<string>('MONGO_PASSWORD');

        // Construimos la ruta blindada
        const uri = `mongodb://${user}:${pass}@mongodb:27017/kanban_db?authSource=admin`;
        return { uri };
      },
    }),
    TasksModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
