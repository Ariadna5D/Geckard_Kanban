import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  /**
   * Email de acceso del usuario
   */
  @ApiProperty({ example: 'usuario@mail.com' })
  // Email se valida antes de intentar buscar usuario
  @IsEmail({}, { message: 'Email no valido' })
  email: string;

  /**
   * Password en texto plano para validar login
   */
  @ApiProperty({ example: 'Usuario123.' })
  // Password viaja en texto plano y se compara contra hash
  @IsString()
  @MinLength(6, { message: 'Contrasena muy corta' })
  password: string;
}
