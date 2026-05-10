import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateColumnDto {
  /**
   * Titulo visible de la columna
   */
  @ApiProperty({ example: 'To Do' })
  // Nombre visible del carril en el tablero
  @IsString()
  @IsNotEmpty({ message: 'El titulo es obligatorio' })
  @MaxLength(50, { message: 'El titulo es demasiado largo' })
  title: string;

  /**
   * Orden fraccional de la columna dentro del tablero
   */
  @ApiProperty({ example: 'a0' })
  // Orden usado para ubicar columna en drag and drop
  @IsString()
  @IsNotEmpty({ message: 'El orden es obligatorio' })
  order: string;
}
