import { SetMetadata } from '@nestjs/common';
import { AppAbility } from './casl-ability.factory';

export type PolicyHandlerCallback = (ability: AppAbility) => boolean;

export const CHECK_POLICIES_KEY = 'check_policy';

// Decorador para aplicar políticas de autorización a rutas o controladores.
export function CheckPolicies(...handlers: PolicyHandlerCallback[]) {
  return SetMetadata(CHECK_POLICIES_KEY, handlers);
}
