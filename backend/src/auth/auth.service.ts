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
   * Valida credenciales contra base de datos.
   * @param email correo del login
   * @param pass contraseña en claro recibida en login
   * @returns usuario sin passwordHash o null si no coincide
   */
  async validateUser(
    email: string,
    pass: string,
  ): Promise<ValidatedUser | null> {
    // Búsqueda por email (normalizado dentro de UsersService).
    const user = await this.usersService.findByEmail(email);

    if (
      user &&
      (await this.usersService.comparePassword(pass, user.passwordHash))
    ) {
      const userDoc = user as UserDocument;
      const userObject = userDoc.toObject() as ValidatedUser & {
        passwordHash: string;
      };

      const { passwordHash, ...result } = userObject;
      void passwordHash;

      return result as ValidatedUser;
    }
    return null;
  }

  /**
   * Genera JWT de acceso para frontend.
   * @param user usuario ya validado
   * @returns objeto con `access_token`
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
