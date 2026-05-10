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

/**
 * Controlador de autenticacion
 */
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  /**
   * Inyecta servicios de auth y usuarios para registro y login
   */
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  /**
   * Crea una cuenta nueva con los datos del formulario
   */
  @Post('register')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async register(@Body() registerDto: RegisterDto) {
    // Crea usuario y guarda hash de password
    return this.usersService.create(registerDto);
  }

  /**
   * Valida credenciales y devuelve token para la sesion
   */
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    // Valida credenciales para evitar token invalido
    const user: ValidatedUser | null = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (user === null) {
      throw new UnauthorizedException('Credenciales no validas');
    }

    // Devuelve token para abrir sesion en frontend
    return this.authService.login(user);
  }
}
