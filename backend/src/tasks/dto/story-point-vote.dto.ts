import { IsIn, IsInt } from 'class-validator';
import { Transform } from 'class-transformer';
import { STORY_POINT_SCALE } from '../schemas/task.schema';

const SCALE = [...STORY_POINT_SCALE] as const;

export class StoryPointVoteDto {
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const n = Number.parseInt(value, 10);
      return Number.isNaN(n) ? value : n;
    }
    return value;
  })
  @IsInt()
  @IsIn(SCALE)
  value: number;
}
