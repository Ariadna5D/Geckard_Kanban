import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateBoardDto } from './create-board.dto';

export class UpdateBoardDto extends PartialType(CreateBoardDto) {
  /**
   * Activa o desactiva modo sprint en el tablero
   */
  @ApiPropertyOptional({
    description: 'Activa o desactiva sprints',
  })
  @IsOptional()
  @IsBoolean()
  sprintsEnabled?: boolean;
}
