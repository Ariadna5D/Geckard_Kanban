import { IsIn, IsInt } from 'class-validator';
import { Transform } from 'class-transformer';
import { STORY_POINT_SCALE } from '../schemas/task.schema';

const SCALE = [...STORY_POINT_SCALE] as const;

export class StoryPointVoteDto {
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      const parsedInt = Number.parseInt(value, 10);
      return Number.isNaN(parsedInt) ? value : parsedInt;
    }
    return value;
  })
  @IsInt()
  @IsIn(SCALE)
  value: number;
}
