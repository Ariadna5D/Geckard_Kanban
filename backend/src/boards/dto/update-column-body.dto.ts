import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Permite editar campos visibles de una columna
 */
export class UpdateColumnBodyDto {
  /**
   * Nuevo titulo de la columna
   */
  @ApiPropertyOptional({ example: 'In progress' })
  // Permite renombrar columna sin tocar otras propiedades
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  /**
   * Tipo de columna para el flujo del tablero
   */
  @ApiPropertyOptional({ enum: ['workflow', 'done', 'archived'] })
  // Cambia tipo para reglas de flujo del tablero
  @IsOptional()
  @IsIn(['workflow', 'done', 'archived'], { message: 'Tipo no valido' })
  columnKind?: 'workflow' | 'done' | 'archived';
}
