// src/casl/policies.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory, AppAbility } from './casl-ability.factory';
import { CHECK_POLICIES_KEY, PolicyHandler } from './policies.decorator';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Reflector extrae las reglas que pusimos en el controlador con @CheckPolicies
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) || [];

    // Si la ruta no tiene el decorador, la dejamos pasar (puede ser pública)
    if (policyHandlers.length === 0) {
      return true;
    }

    // 2. Extraemos el usuario de la petición.
    // OJO: Esto asume que tu JwtAuthGuard ya se ejecutó y metió al usuario en req.user
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false; // Si no hay usuario en este punto, bloqueamos
    }

    // 3. Fabricamos los poderes específicos para este usuario
    const ability = this.caslAbilityFactory.createForUser(user);

    // 4. Evaluamos TODAS las políticas que le pusimos a la ruta.
    // Si falla una sola, se bloquea (devuelve false).
    return policyHandlers.every((handler) =>
      this.execPolicyHandler(handler, ability),
    );
  }

  // Función auxiliar para ejecutar la regla dependiendo de si la pasamos
  // como una función flecha o como una clase entera.
  private execPolicyHandler(handler: PolicyHandler, ability: AppAbility) {
    if (typeof handler === 'function') {
      return handler(ability);
    }
    return handler.handle(ability);
  }
}
