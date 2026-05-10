import { IsMongoId, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTaskPositionDto {
  /**
   * Id de la columna destino al mover la tarea
   */
  @ApiProperty({
    example: '69cbf0752cde49f774295b7e',
    description: 'ID de la nueva columna',
  })
  // Columna destino al soltar la tarjeta
  @IsMongoId()
  @IsNotEmpty({ message: 'NewColumnId es obligatorio' })
  newColumnId: string;

  /**
   * Nuevo orden fraccional para ubicar la tarea
   */
  @ApiProperty({
    example: 'a0V3x',
    description: 'Orden de la tarea',
  })
  // Orden final para renderizar en nueva posicion
  @IsString()
  @IsNotEmpty({ message: 'NewOrder es obligatorio' })
  newOrder: string;
}
