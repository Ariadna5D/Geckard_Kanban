import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateColumnDto {
  // TITULO DE LA COLUMNA
  @ApiProperty({ example: 'To Do' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  title: string;

  // ORDEN DE LA COLUMNA
  @IsString()
  @IsNotEmpty()
  order: string;
}
