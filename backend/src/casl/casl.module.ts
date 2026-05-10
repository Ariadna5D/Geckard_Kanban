import { Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';

/**
 * Modulo CASL
 */
@Module({
  providers: [CaslAbilityFactory],
  exports: [CaslAbilityFactory],
})
export class CaslModule {}
