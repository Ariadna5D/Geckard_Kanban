import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  /**
   * Datos minimos para registrar una cuenta nueva
   */
  @ApiProperty({ example: 'Usuario', description: 'Nombre de usuario' })
  @IsString({ message: 'Nombre no valido' })
  @MinLength(3, { message: 'Nombre muy corto' })
  @MaxLength(20, { message: 'Nombre muy largo' })
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'Nombre no valido',
  })
  username: string;

  @ApiProperty({
    example: 'usuario@mail.com',
    description: 'Correo electronico',
  })
  // Se valida formato de email para evitar registro con dato roto
  @IsEmail({}, { message: 'Email no valido' })
  email: string;

  @ApiProperty({
    example: 'Usuario123.',
    description: 'Contrasena del usuario',
  })
  // Exige minimo de seguridad antes de crear cuenta
  @IsString()
  @MinLength(8, {
    message: 'Contrasena muy corta',
  })
  @MaxLength(64, {
    message: 'Contrasena muy larga',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9\\s]).{8,64}$/, {
    message: 'Contrasena no valida',
  })
  password: string;
}
