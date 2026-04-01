import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory, JwtAuthUser } from './casl-ability.factory';
import {
  CHECK_POLICIES_KEY,
  PolicyHandlerCallback,
} from './policies.decorator';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Extraemos los handlers (las reglas) que pusimos en el decorador @CheckPolicies
    const policyHandlers =
      this.reflector.get<PolicyHandlerCallback[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) || [];

    // Obtenemos el usuario que el JwtAuthGuard inyectó en la Request
    const { user } = context.switchToHttp().getRequest<{ user: JwtAuthUser }>();

    // Creamos las habilidades (permisos) para ese usuario concreto
    const ability = this.caslAbilityFactory.createForUser(user);

    // Ejecutamos cada regla y verificamos si todas devuelven 'true'
    return policyHandlers.every((handler) => handler(ability));
  }
}
