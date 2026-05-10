import { IsIn, IsInt } from 'class-validator';
import { Transform } from 'class-transformer';
import { STORY_POINT_SCALE } from '../schemas/task.schema';

export class StoryPointVoteDto {
  /**
   * Convierte texto a numero
   */
  @Transform(({ value }: { value: unknown }) => {
    // Permite que el front envie numero como string sin romper dto
    if (typeof value === 'string') {
      const parsedInt = Number.parseInt(value, 10);
      return Number.isNaN(parsedInt) ? value : parsedInt;
    }
    return value;
  })
  @IsInt()
  @IsIn(STORY_POINT_SCALE)
  value: number;
}
