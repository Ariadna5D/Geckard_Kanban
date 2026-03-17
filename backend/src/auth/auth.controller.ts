import { Controller, Post, Body, UnauthorizedException, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

@Controller('auth') 
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Body() signUpDto: any) {
    return this.usersService.create(
      signUpDto.email, 
      signUpDto.password, 
      signUpDto.role 
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK) 
  async login(@Body() loginDto: any) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Devolvemos el access_token
    return this.authService.login(user);
  }
}