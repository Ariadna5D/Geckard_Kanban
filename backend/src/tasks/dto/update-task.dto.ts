import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, ValidateIf, IsMongoId } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

/**
 * Permite actualizar campos editables de la tarea
 */
export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['sprintId'] as const),
) {
  /**
   * Permite mover la tarea al sprint activo o sacarla con null
   */
  @ApiPropertyOptional({
    nullable: true,
    description: 'Id de sprint activo o null',
  })
  // Se permite null para sacar tarea del sprint activo
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsMongoId({ message: 'SprintId no valido' })
  sprintId?: string | null;
}
