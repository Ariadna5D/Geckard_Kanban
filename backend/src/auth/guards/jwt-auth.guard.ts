import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guardia para validar tokens JWT.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
