import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guarda de autenticacion jwt
 */
@Injectable()
// Extiende guard de passport para centralizar auth bearer en rutas
export class JwtAuthGuard extends AuthGuard('jwt') {}
