import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  it('deberia devolver el saludo base de la api en este caso simple', async () => {
    // Monta modulo minimo para este escenario
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    const appController = app.get<AppController>(AppController);
    expect(appController.getHello()).toBe('Geckard API');
  });
});
