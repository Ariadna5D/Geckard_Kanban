import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory, JwtAuthUser } from './casl-ability.factory';
import {
  CHECK_POLICIES_KEY,
  PolicyHandlerCallback,
} from './policies.decorator';

type RequestWithJwtUser = {
  user: JwtAuthUser;
};

@Injectable()
export class PoliciesGuard implements CanActivate {
  /**
   * Inyecta reflector y fabrica de permisos globales
   */
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  /**
   * Ejecuta validaciones de permisos declaradas en la ruta
   */
  canActivate(context: ExecutionContext): boolean {
    const handlersFromDecorator = this.reflector.getAllAndOverride<
      PolicyHandlerCallback[] | undefined
    >(CHECK_POLICIES_KEY, [context.getHandler(), context.getClass()]);
    let policyHandlers: PolicyHandlerCallback[] = [];
    if (handlersFromDecorator !== undefined && handlersFromDecorator !== null) {
      policyHandlers = handlersFromDecorator;
    }
    const httpRequest = context.switchToHttp().getRequest<RequestWithJwtUser>();
    const authenticatedUser = httpRequest.user;
    const userAbility =
      this.caslAbilityFactory.createForUser(authenticatedUser);

    // Recorre politicas y corta cuando una no permite la accion
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
