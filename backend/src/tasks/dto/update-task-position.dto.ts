import { IsMongoId, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTaskPositionDto {
  @ApiProperty({ description: 'ID de la nueva columna donde cae la tarea' })
  @IsMongoId()
  newColumnId: string;

  @ApiProperty({
    description:
      'Orden de la tarea que queda por encima (null si es la primera)',
  })
  @IsNumber()
  @IsOptional()
  prevTaskOrder: number | null;

  @ApiProperty({
    description:
      'Orden de la tarea que queda por debajo (null si es la última)',
  })
  @IsNumber()
  @IsOptional()
  nextTaskOrder: number | null;
}
