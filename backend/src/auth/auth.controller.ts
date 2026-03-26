import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ValidatedUser } from './interfaces/user';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  /**
   * Endpoint de Registro.
   */
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.usersService.create(registerDto);
  }

  /**
   * Endpoint de Login.
   * Si las credenciales son correctas, devuelve el access_token.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    const user: ValidatedUser | null = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    // Si el servicio devuelve null, lanzamos la excepción de Unauthorized
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Si el usuario es válido, generamos y devolvemos el token
    return this.authService.login(user);
  }
}
