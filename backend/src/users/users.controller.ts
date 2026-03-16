import { Controller } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Por ahora lo dejamos limpio. 
  // La creación de usuarios ya la maneja el AuthController.
  // Más adelante, aquí crearemos rutas como obtener el perfil del usuario,
  // pero primero necesitamos la Estrategia JWT para protegerlas.
}