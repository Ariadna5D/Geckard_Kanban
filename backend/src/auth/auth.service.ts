import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { ValidatedUser } from './interfaces/user';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  /**
   * Inyecta usuarios y jwt para validar acceso y crear token
   */
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  /**
   * Comprueba email y password para iniciar sesion
   */
  async validateUser(
    email: string,
    plainPassword: string,
  ): Promise<ValidatedUser | null> {
    // Busca por email para comprobar si la cuenta existe
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }
    // Compara password plano contra hash guardado en base de datos
    const passwordMatches = await this.usersService.comparePassword(
      plainPassword,
      user.passwordHash,
    );
    if (!passwordMatches) {
      return null;
    }
    const persistedUser = user as UserDocument;
    return {
      _id: persistedUser._id,
      email: persistedUser.email,
      username: persistedUser.username,
      role: persistedUser.role,
    };
  }

  /**
   * Genera token jwt con los datos minimos del usuario
   */
  login(user: ValidatedUser): { access_token: string } {
    // Payload minimo para identificar usuario y rol en rutas protegidas
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
