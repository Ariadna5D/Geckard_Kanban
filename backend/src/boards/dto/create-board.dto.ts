import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBoardDto {
  // TITULO DEL TABLERO
  @ApiProperty({
    example: 'Proyecto de TFG',
    description: 'El título del tablero Kanban',
  })
  @IsString()
  @IsNotEmpty({ message: 'El título del tablero es obligatorio' })
  @MaxLength(100, { message: 'El título no puede exceder los 100 caracteres' })
  title: string;

  // DESCRIPCIÓN DEL TABLERO
  @ApiProperty({
    example: 'Gestión de tareas para el desarrollo de la plataforma',
    description: 'Una breve descripción del propósito del tablero',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'La descripción es demasiado larga' })
  description?: string;
}
