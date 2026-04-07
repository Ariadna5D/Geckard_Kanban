import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { ValidatedUser } from './interfaces/user';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  /**
   * Mira si el email y la contraseña coinciden con un usuario guardado.
   * Si no, devuelve null (el controlador mostrará “credenciales inválidas”).
   */
  async validateUser(
    email: string,
    pass: string,
  ): Promise<ValidatedUser | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const passwordMatches = await this.usersService.comparePassword(
      pass,
      user.passwordHash,
    );
    if (!passwordMatches) return null;
    const doc = user as UserDocument;
    return {
      _id: doc._id,
      email: doc.email,
      username: doc.username,
      role: doc.role,
    };
  }

  /**
   * Crea el token que el front guardará para las siguientes peticiones.
   */
  login(user: ValidatedUser) {
    const payload = {
      email: user.email,
      sub: user._id.toString(),
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
