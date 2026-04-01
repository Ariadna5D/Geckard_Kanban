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
   * Valida las credenciales del usuario.
   * @param email
   * @param pass
   * @returns El usuario validado sin el passwordHash, o null si las credenciales son inválidas.
   */
  async validateUser(
    email: string,
    pass: string,
  ): Promise<ValidatedUser | null> {
    //Buscamos el usuario por su email
    const user = await this.usersService.findByEmail(email);

    if (
      user &&
      (await this.usersService.comparePassword(pass, user.passwordHash)) // Si la contraseña es correcta, devolvemos el usuario sin el passwordHash
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
   * Genera un JWT para el usuario validado.
   * @param user El usuario validado del cual se extraerá la información para el payload del token.
   * @returns Un objeto con el access_token.
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
