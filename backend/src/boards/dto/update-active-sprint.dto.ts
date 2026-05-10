import { IsString, IsOptional, MaxLength, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Permite editar los campos principales del sprint activo
 */
export class UpdateActiveSprintDto {
  /**
   * Nombre corto visible en cabecera del sprint
   */
  @ApiPropertyOptional({ example: 'Sprint 2' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  /**
   * Fecha de inicio planificada en formato iso
   */
  @ApiPropertyOptional({ example: '2026-04-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  /**
   * Fecha de fin planificada en formato iso
   */
  @ApiPropertyOptional({ example: '2026-04-14T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  plannedEndAt?: string;

  /**
   * Objetivo del sprint para dar contexto al equipo
   */
  @ApiPropertyOptional({
    description: 'Objetivo del sprint',
    maxLength: 2000,
  })
  // Texto libre para explicar objetivo al equipo
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  objective?: string;
}
