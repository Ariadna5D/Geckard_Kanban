import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  // Paso A: Validar al usuario
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);

    if (user && (await this.usersService.comparePassword(pass, user.passwordHash))) {
      // Si todo coincide, extraemos el hash para no incluirlo en el token
      const { passwordHash, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  // Paso B: Generar el token (El "Login" oficial)
  async login(user: any) {
    const payload = { 
      email: user.email, 
      sub: user._id, 
      role: user.role // Metemos el rol en el token para el sistema de permisos
    };
    
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}