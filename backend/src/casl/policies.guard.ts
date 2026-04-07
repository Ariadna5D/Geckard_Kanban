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

  /**
   * Comprueba las reglas que pusimos con @CheckPolicies (por ejemplo “solo admin”).
   */
  canActivate(context: ExecutionContext): boolean {
    const policyHandlers =
      this.reflector.get<PolicyHandlerCallback[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) || [];

    const { user } = context.switchToHttp().getRequest<{ user: JwtAuthUser }>();
    const ability = this.caslAbilityFactory.createForUser(user);

    for (const handler of policyHandlers) {
      if (!handler(ability)) {
        return false;
      }
    }
    return true;
  }
}
