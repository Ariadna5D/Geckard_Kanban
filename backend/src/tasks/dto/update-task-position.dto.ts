import { IsMongoId, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTaskPositionDto {
  @ApiProperty({
    example: '69cbf0752cde49f774295b7e',
    description: 'ID de la nueva columna donde cae la tarea',
  })
  @IsMongoId()
  newColumnId: string;

  @ApiProperty({
    type: Number, // Forzamos a Swagger a ver un número
    nullable: true, // Le decimos que puede ser null
    example: 1500,
    description:
      'Orden de la tarea que queda por encima (null si es la primera)',
  })
  @IsNumber()
  @IsOptional()
  prevTaskOrder: number | null;

  @ApiProperty({
    type: Number, // Forzamos a Swagger a ver un número
    nullable: true,
    example: 2500,
    description:
      'Orden de la tarea que queda por debajo (null si es la última)',
  })
  @IsNumber()
  @IsOptional()
  nextTaskOrder: number | null;
}
