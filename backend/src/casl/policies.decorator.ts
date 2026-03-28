import { SetMetadata } from '@nestjs/common';
import { AppAbility } from './casl-ability.factory';

// Definimos la estructura de lo que acepta nuestro decorador
interface IPolicyHandler {
  handle(ability: AppAbility): boolean;
}

type PolicyHandlerCallback = (ability: AppAbility) => boolean;

export type PolicyHandler = IPolicyHandler | PolicyHandlerCallback;

// Esta es la clave interna que NestJS usará para guardar la regla en la memoria
export const CHECK_POLICIES_KEY = 'check_policy';

// ¡El decorador final!
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
