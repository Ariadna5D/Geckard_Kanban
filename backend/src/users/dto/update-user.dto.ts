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
  /**
   * Nuevo nombre visible del usuario
   */
  @ApiPropertyOptional({ description: 'Nuevo nombre de usuario' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @Matches(/^[^<>]+$/, { message: 'Nombre no valido' })
  @MaxLength(20, { message: 'Nombre muy largo' })
  username?: string;

  /**
   * Nuevo email para la cuenta
   */
  @ApiPropertyOptional({ description: 'Nuevo correo electrónico' })
  // Email opcional para cambio de cuenta
  @IsOptional()
  @IsEmail({}, { message: 'Email no valido' })
  email?: string;

  /**
   * Texto corto de perfil del usuario
   */
  @ApiPropertyOptional({ description: 'Biografía del usuario' })
  @IsOptional()
  @IsString()
  @MaxLength(200, {
    message: 'Bio muy larga',
  })
  @Matches(/^[^<>]*$/, {
    message: 'Bio no valida',
  })
  bio?: string;

  /**
   * Url del avatar del usuario
   */
  @ApiPropertyOptional({
    description: 'URL del avatar',
  })
  // Url ya subida a cloudinary para persistir avatar
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
