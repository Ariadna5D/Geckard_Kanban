import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

/**
 * `sprintId` puede ser un id, cadena vacía o `null` (vuelve la tarea al backlog).
 * La validación fina de ObjectId queda en `TasksService.update`.
 */
export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['sprintId'] as const),
) {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf(
    (_, v) => v !== null && v !== undefined && String(v).trim() !== '',
  )
  @IsString()
  @MaxLength(24)
  sprintId?: string | null;
}
