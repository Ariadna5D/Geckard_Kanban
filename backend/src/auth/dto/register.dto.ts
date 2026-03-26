import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Usuario', description: 'Nombre de usuario único' })
  @IsString({ message: 'El nombre debe ser un texto' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(20, { message: 'El nombre no puede tener más de 20 caracteres' })
  username: string;

  @ApiProperty({
    example: 'usuario@mail.com',
    description: 'Correo electrónico válido',
  })
  @IsEmail({}, { message: 'El formato del email no es válido' })
  email: string;

  @ApiProperty({
    example: 'usuario',
    description: 'Contraseña del usuario',
  })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}
