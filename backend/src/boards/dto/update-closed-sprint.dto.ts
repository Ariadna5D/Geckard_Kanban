import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Permite cambiar el nombre de un sprint cerrado
 */
export class UpdateClosedSprintDto {
  /**
   * Define el nombre nuevo que se mostrara en historial de cerrados
   */
  @ApiProperty({ example: 'Sprint 1 nuevo nombre' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(80, { message: 'El nombre es demasiado largo' })
  sprintName: string;
}
