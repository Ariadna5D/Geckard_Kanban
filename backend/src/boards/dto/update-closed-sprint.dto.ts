import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** PATCH a closed sprint row (rename only in history). */
export class UpdateClosedSprintDto {
  @ApiProperty({ example: 'Sprint 1 (renamed)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sprintName: string;
}
