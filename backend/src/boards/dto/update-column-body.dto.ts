import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * PATCH /boards/:id/columns/:columnId — rename and/or change how the column counts for sprint close.
 */
export class UpdateColumnBodyDto {
  @ApiPropertyOptional({ example: 'In progress' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ enum: ['workflow', 'done', 'archived'] })
  @IsOptional()
  @IsIn(['workflow', 'done', 'archived'])
  columnKind?: 'workflow' | 'done' | 'archived';
}
