import { SetMetadata } from '@nestjs/common';
import { AppAbility } from './casl-ability.factory';

export type PolicyHandlerCallback = (ability: AppAbility) => boolean;

export const CHECK_POLICIES_KEY = 'check_policy';

/**
 * Asocia politicas a una ruta o controlador
 */
export function CheckPolicies(...handlers: PolicyHandlerCallback[]) {
  // Guarda politicas para el guard
  return SetMetadata(CHECK_POLICIES_KEY, handlers);
}
