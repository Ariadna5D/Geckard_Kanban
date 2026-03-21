import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema'; // 1. Importamos el tipo real de Mongoose

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);

    if (
      user &&
      (await this.usersService.comparePassword(pass, user.passwordHash))
    ) {
      // 2. Casteamos el usuario al tipo Documento para que TS no llore
      const userDoc = user as UserDocument; 
      
      const userObject = userDoc.toObject ? userDoc.toObject() : userDoc;
      const { passwordHash, ...result } = userObject;
      
      return result;
    }
    return null;
  }

  // Generar el token
  async login(user: any) {
    const payload = {
      email: user.email,
      sub: user._id.toString(), // Mongoose usa _id por defecto
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}