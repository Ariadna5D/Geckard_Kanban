import { Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';

/**
 * CASL centraliza “qué puede hacer cada usuario” (lectura, edición, borrado…).
 * Otros módulos importan CaslModule para usar PoliciesGuard o inyectar la factory.
 */
@Module({
  providers: [CaslAbilityFactory],
  exports: [CaslAbilityFactory],
})
export class CaslModule {}
