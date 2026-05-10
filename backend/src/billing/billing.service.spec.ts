import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { UsersService } from '../users/users.service';

describe('BillingService', () => {
  it('deberia crear el servicio con dependencias simuladas en este caso', async () => {
    // Inyecta dependencias fake para este escenario
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: ConfigService, useValue: {} },
        { provide: UsersService, useValue: {} },
      ],
    }).compile();

    const service = module.get<BillingService>(BillingService);
    expect(service).toBeDefined();
  });
});
