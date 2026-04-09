import { IsArray, ArrayNotEmpty, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderSprintsDto {
  @ApiProperty({
    description: 'Ids de todos los sprints del tablero en el orden deseado en el desplegable',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  sprintIds: string[];
}
