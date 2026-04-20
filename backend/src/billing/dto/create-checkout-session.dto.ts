import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutSessionDto {
  @ApiProperty({ enum: ['pro', 'team'] })
  @IsIn(['pro', 'team'], {
    message: 'plan debe ser pro o team',
  })
  plan: 'pro' | 'team';
}
