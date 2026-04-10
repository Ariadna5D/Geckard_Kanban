import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { ValidatedUser } from './interfaces/user';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  /**
   * Valida las credenciales de un usuario.
   * @param email El email del usuario.
   * @param pass La contraseña del usuario.
   * @returns El usuario validado o null si las credenciales son incorrectas.
   */
  async validateUser(
    email: string,
    pass: string,
  ): Promise<ValidatedUser | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }
    const passwordMatches = await this.usersService.comparePassword(
      pass,
      user.passwordHash,
    );
    if (!passwordMatches) {
      return null;
    }
    const doc = user as UserDocument;
    return {
      _id: doc._id,
      email: doc.email,
      username: doc.username,
      role: doc.role,
    };
  }

  /**
   * Inicia sesión para un usuario validado.
   * @param user El usuario validado.
   * @returns El token de acceso.
   */
  login(user: ValidatedUser): { access_token: string } {
    const payload: JwtPayload = {
      email: user.email,
      sub: user._id.toString(),
      role: user.role,
    };
    const token = this.jwtService.sign(payload);
    return {
      access_token: token,
    };
  }
}
