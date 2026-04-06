import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ValidatedUser } from './interfaces/user';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  /**
   * Registro de usuario.
   * Límite estricto para evitar abuso/bots en creación de cuentas.
   */
  @Post('register')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async register(@Body() registerDto: RegisterDto) {
    return this.usersService.create(registerDto);
  }

  /**
   * Inicio de sesión.
   * Si email/contraseña son válidos, devuelve el JWT de acceso.
   */
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    const user: ValidatedUser | null = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    // Si no valida, respondemos error genérico de credenciales.
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Token firmado con email + id + rol.
    return this.authService.login(user);
  }
}
