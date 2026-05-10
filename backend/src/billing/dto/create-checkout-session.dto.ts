import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutSessionDto {
  /**
   * Plan destino para crear el checkout de pago
   */
  @ApiProperty({ enum: ['pro', 'team'] })
  @IsIn(['pro', 'team'], {
    message: 'Plan no valido',
  })
  plan: 'pro' | 'team';
}
