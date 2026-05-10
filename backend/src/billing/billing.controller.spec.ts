import { Test, TestingModule } from '@nestjs/testing';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

describe('BillingController', () => {
  it('deberia crear el controlador con servicio simulado en este caso', async () => {
    // Usa stub de servicio para este escenario
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [{ provide: BillingService, useValue: {} }],
    }).compile();

    const controller = module.get<BillingController>(BillingController);
    expect(controller).toBeDefined();
  });
});
