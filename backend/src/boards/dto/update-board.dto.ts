import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateBoardDto } from './create-board.dto';

export class UpdateBoardDto extends PartialType(CreateBoardDto) {
  @ApiPropertyOptional({
    description:
      'When true, board admins allow sprint mode (one active sprint, history on close).',
  })
  @IsOptional()
  @IsBoolean()
  sprintsEnabled?: boolean;
}
