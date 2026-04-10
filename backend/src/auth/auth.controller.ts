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
   * REGISTER: crea un nuevo usuario con email, username y password. Devuelve el usuario creado (sin password).
   * @param registerDto Los datos de registro del usuario (email, username, password)
   * @returns El usuario creado (sin password)
   */
  @Post('register')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async register(@Body() registerDto: RegisterDto) {
    return this.usersService.create(registerDto);
  }

  /**
   * LOGIN: valida credenciales y, si son correctas, devuelve { access_token }.
   * @param loginDto Los datos de inicio de sesión (email, password)
   * @returns El token de acceso
   */
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    const user: ValidatedUser | null = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (user === null) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.authService.login(user);
  }
}
