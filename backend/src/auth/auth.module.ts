import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * JWT Module options factory: lee el secreto de JWT_SECRET y configura expiración a 8 horas
 */
function createJwtModuleOptions(configService: ConfigService) {
  const secretRaw = configService.get<string>('JWT_SECRET');
  let secret = '';
  if (secretRaw !== undefined && secretRaw !== null) {
    secret = secretRaw.trim();
  }
  if (secret === '') {
    throw new Error('JWT_SECRET es obligatoria para firmar tokens.');
  }
  const eightHoursSeconds = 8 * 60 * 60; // 8 horas en segundos
  return {
    secret,
    signOptions: { expiresIn: eightHoursSeconds },
  };
}

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createJwtModuleOptions,
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
