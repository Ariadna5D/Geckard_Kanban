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
  /** Nuevo username (opcional). */
  @ApiPropertyOptional({ description: 'Nuevo nombre de usuario' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  // Evita inyección/XSS al restringir caracteres típicos de tags HTML.
  @Matches(/^[^<>]+$/, { message: 'El nombre no puede contener < ni >.' })
  @MaxLength(20, { message: 'El nombre no puede tener más de 20 caracteres' })
  username?: string;

  /** Nuevo email (opcional). */
  @ApiPropertyOptional({ description: 'Nuevo correo electrónico' })
  @IsOptional()
  @IsEmail({}, { message: 'El formato del email no es válido' })
  email?: string;

  /** Biografía corta de perfil (opcional). */
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

  /** URL de avatar ya subida (normalmente la fija backend tras Cloudinary). */
  @ApiPropertyOptional({
    description: 'URL del avatar',
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
