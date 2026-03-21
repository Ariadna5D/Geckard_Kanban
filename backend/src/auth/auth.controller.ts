import { Controller, Post, Body, UnauthorizedException, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto'; // <-- Importamos los DTOs
import { LoginDto } from './dto/login.dto';

@Controller('auth') 
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('register')
  // Usamos RegisterDto. Si los datos están mal, el ValidationPipe corta aquí
  async register(@Body() registerDto: RegisterDto) { 
    // Ahora le pasamos el DTO entero al servicio, no parámetros sueltos
    return this.usersService.create(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK) 
  // Usamos LoginDto
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.authService.login(user);
  }
}