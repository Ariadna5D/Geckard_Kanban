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

  // Ejecuta los handlers de políticas definidos en el decorador @CheckPolicies.
  canActivate(context: ExecutionContext): boolean {
    const handlersFromDecorator = this.reflector.get<
      PolicyHandlerCallback[] | undefined
    >(CHECK_POLICIES_KEY, context.getHandler()); // Primero miramos si hay handlers en el método

    // Si no hay handlers en el método, miramos si hay en el controlador
    let policyHandlers: PolicyHandlerCallback[] = [];
    if (handlersFromDecorator !== undefined && handlersFromDecorator !== null) {
      policyHandlers = handlersFromDecorator;
    }

    // Si no hay handlers, dejamos pasar
    const httpRequest = context
      .switchToHttp()
      .getRequest<{ user: JwtAuthUser }>();
    const authenticatedUser = httpRequest.user;
    const userAbility =
      this.caslAbilityFactory.createForUser(authenticatedUser);

    // Ejecutamos cada handler de política. Si alguno falla, denegamos el acceso
    for (let index = 0; index < policyHandlers.length; index++) {
      const singlePolicyCheck = policyHandlers[index];
      const policyAllows = singlePolicyCheck(userAbility);
      if (!policyAllows) {
        return false;
      }
    }

    return true;
  }
}
