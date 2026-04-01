import { IsMongoId, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTaskPositionDto {
  @ApiProperty({
    example: '69cbf0752cde49f774295b7e',
    description: 'ID de la nueva columna donde se suelta la tarea',
  })
  @IsMongoId()
  @IsNotEmpty()
  newColumnId: string;

  @ApiProperty({
    example: 'a0V3x',
    description:
      'El índice fraccional exacto (string) calculado por el frontend',
  })
  @IsString()
  @IsNotEmpty()
  newOrder: string;
}
