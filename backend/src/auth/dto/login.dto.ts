import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  /** Correo usado para autenticación */
  @ApiProperty({ example: 'usuario@mail.com' })
  @IsEmail({}, { message: 'El formato del email no es válido' })
  email: string;

  /** Contraseña en claro enviada por formulario de login */
  @ApiProperty({ example: 'usuario' })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}
