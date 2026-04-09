import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSprintDto {
  @ApiProperty({ example: 'Sprint 3 — Integración' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  goal?: string;

  @ApiProperty({ required: false, example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiProperty({ required: false, example: '2026-04-14' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  /**
   * Si es true (por defecto), los sprints activos previos del mismo tablero pasan a `completed`.
   */
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  closePreviousActive?: boolean;

  /**
   * Si es false, el sprint se crea como `completed` (solo lista / histórico) sin activarlo.
   */
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  makeActive?: boolean;
}
