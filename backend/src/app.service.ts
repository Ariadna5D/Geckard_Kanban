import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /**
   * Devuelve texto base del backend
   */
  getHello(): string {
    return 'Geckard API';
  }
}
