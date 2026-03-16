// src/auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
// Extendemos el AuthGuard de Passport y le decimos que use la estrategia 'jwt'
export class JwtAuthGuard extends AuthGuard('jwt') {}