import { Controller, Post, Body, UnauthorizedException, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

@Controller('auth') // Ruta base: /auth
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  // 1. Registro de usuario
  @Post('register')
  async register(@Body() signUpDto: any) {
    // Usamos el método create que preparamos en el UsersService
    return this.usersService.create(
      signUpDto.email, 
      signUpDto.password, 
      signUpDto.role // Opcional
    );
  }

  // 2. Login de usuario
  @Post('login')
  @HttpCode(HttpStatus.OK) // Por defecto los POST devuelven 201, pero login suele ser 200
  async login(@Body() loginDto: any) {
    // Validamos credenciales
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Devolvemos el access_token
    return this.authService.login(user);
  }
}