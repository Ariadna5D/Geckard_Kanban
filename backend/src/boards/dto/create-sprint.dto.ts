import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSprintDto {
  @ApiProperty({ example: 'Sprint 1', description: 'Short name shown in the board' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del sprint es obligatorio' })
  @MaxLength(80, { message: 'El nombre del sprint es demasiado largo' })
  name: string;

  @ApiPropertyOptional({
    description: 'Planned start (ISO). Defaults to now if omitted.',
  })
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @ApiPropertyOptional({
    description: 'Planned end date (ISO). Optional.',
  })
  @IsOptional()
  @IsDateString()
  plannedEndAt?: string;

  @ApiPropertyOptional({
    description: 'Sprint goal / focus (optional, shown in the board header).',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'El objetivo del sprint es demasiado largo' })
  objective?: string;
}