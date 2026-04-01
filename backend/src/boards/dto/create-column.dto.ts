import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateColumnDto {
  @ApiProperty({ example: 'To Do' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  title: string;

  @IsString()
  @IsNotEmpty()
  order: string;
}
