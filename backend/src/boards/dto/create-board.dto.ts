import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBoardDto {
  /**
   * Titulo visible del tablero
   */
  @ApiProperty({
    example: 'Proyecto de TFG',
    description: 'Titulo del tablero',
  })
  // Campo principal para identificar tablero
  @IsString()
  @IsNotEmpty({ message: 'El título del tablero es obligatorio' })
  @MaxLength(100, { message: 'El titulo es demasiado largo' })
  title: string;

  /**
   * Descripcion corta del tablero
   */
  @ApiProperty({
    example: 'Gestión de tareas para el desarrollo de la plataforma',
    description: 'Descripcion corta del tablero',
    required: false,
  })
  // Resumen breve para dar contexto al equipo
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'La descripcion es demasiado larga' })
  description?: string;
}
