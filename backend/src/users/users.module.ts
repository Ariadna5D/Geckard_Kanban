import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { CaslModule } from '../casl/casl.module';

/**
 * Modulo de usuarios
 */
@Module({
  imports: [
    // Carga esquema de usuario
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // Usa cloudinary para avatar
    CloudinaryModule,
    // Usa CASL para permisos
    CaslModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
