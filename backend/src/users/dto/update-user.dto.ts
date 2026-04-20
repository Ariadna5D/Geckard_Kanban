import {
  IsString,
  IsOptional,
  MinLength,
  IsEmail,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Nuevo nombre de usuario' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @Matches(/^[^<>]+$/, { message: 'El nombre no puede contener < ni >.' })
  @MaxLength(20, { message: 'El nombre no puede tener más de 20 caracteres' })
  username?: string;

  /** Email  */
  @ApiPropertyOptional({ description: 'Nuevo correo electrónico' })
  @IsOptional()
  @IsEmail({}, { message: 'El formato del email no es válido' })
  email?: string;

  /** Biografía corta de perfil  */
  @ApiPropertyOptional({ description: 'Biografía del usuario' })
  @IsOptional()
  @IsString()
  @MaxLength(200, {
    message: 'La biografía no puede tener más de 200 caracteres',
  })
  @Matches(/^[^<>]*$/, {
    message: 'La biografía no puede contener < ni >.',
  })
  bio?: string;

  /** URL de avatar ya subida  */
  @ApiPropertyOptional({
    description: 'URL del avatar',
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
