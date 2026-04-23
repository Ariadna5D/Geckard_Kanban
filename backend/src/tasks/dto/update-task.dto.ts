import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, ValidateIf, IsMongoId } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

/**
 * `sprintId: null` clears the sprint tag on the task (allowed any time).
 * A string must match the board active sprint when sprints are enabled.
 */
export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['sprintId'] as const),
) {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Active sprint id, or null to remove from sprint',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsMongoId({ message: 'El sprintId debe ser un ID válido de MongoDB' })
  sprintId?: string | null;
}
