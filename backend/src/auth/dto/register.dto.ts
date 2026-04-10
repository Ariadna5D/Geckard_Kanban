import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  /** Nombre de usuario*/
  @ApiProperty({ example: 'Usuario', description: 'Nombre de usuario único' })
  @IsString({ message: 'El nombre debe ser un texto' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(20, { message: 'El nombre no puede tener más de 20 caracteres' })
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'El nombre de usuario solo puede contener letras, números y _.',
  })
  username: string;

  /** Email*/
  @ApiProperty({
    example: 'usuario@mail.com',
    description: 'Correo electrónico válido',
  })
  @IsEmail({}, { message: 'El formato del email no es válido' })
  email: string;

  /** Contraseña */
  @ApiProperty({
    example: 'usuario',
    description: 'Contraseña del usuario',
  })
  @IsString()
  @MinLength(8, {
    message: 'La contraseña debe tener al menos 8 caracteres',
  })
  @MaxLength(64, {
    message: 'La contraseña no puede tener más de 64 caracteres',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9\\s]).{8,64}$/, {
    message:
      'La contraseña debe tener al menos 8 caracteres e incluir 1 minúscula, 1 mayúscula y 1 carácter especial.',
  })
  password: string;
}
