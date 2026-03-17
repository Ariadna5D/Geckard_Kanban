import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

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
      const userObject = user.toObject ? user.toObject() : user;
      const { passwordHash, ...result } = userObject;
      return result;
    }
    return null;
  }

  // Generar el token
  async login(user: any) {
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
