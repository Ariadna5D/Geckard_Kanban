import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  /**
   * Inyecta servicio base para endpoint de saludo
   */
  constructor(private readonly appService: AppService) {}

  /**
   * Endpoint simple para comprobar que la api responde
   */
  @Get()
  getHello(): string {
    // Devuelve mensaje corto para health basico
    return this.appService.getHello();
  }
}
