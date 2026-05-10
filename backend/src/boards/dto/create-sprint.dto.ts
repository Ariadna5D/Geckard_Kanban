import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSprintDto {
  /**
   * Nombre corto que vera el equipo en el sprint
   */
  @ApiProperty({
    example: 'Sprint 1',
    description: 'Nombre corto visible en el tablero',
  })
  // Nombre visible en cabecera del sprint activo
  @IsString()
  @IsNotEmpty({ message: 'El nombre del sprint es obligatorio' })
  @MaxLength(80, { message: 'El nombre del sprint es demasiado largo' })
  name: string;

  /**
   * Fecha de inicio planificada en formato iso
   */
  @ApiPropertyOptional({
    description: 'Inicio planificado',
  })
  // Si no llega fecha el servicio usa fecha actual
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  /**
   * Fecha de fin planificada en formato iso
   */
  @ApiPropertyOptional({
    description: 'Fin planificado',
  })
  // Fecha de cierre planificada para seguimiento
  @IsOptional()
  @IsDateString()
  plannedEndAt?: string;

  /**
   * Objetivo funcional del sprint para el equipo
   */
  @ApiPropertyOptional({
    description: 'Objetivo del sprint',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'El objetivo es demasiado largo' })
  objective?: string;
}
