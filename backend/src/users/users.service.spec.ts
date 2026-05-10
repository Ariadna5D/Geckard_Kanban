import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';

describe('UsersService', () => {
  it('deberia crear el servicio con el modelo simulado en este caso', async () => {
    // Modelo fake para este escenario
    const fakeUserModel = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: fakeUserModel,
        },
      ],
    }).compile();

    const service = module.get<UsersService>(UsersService);
    expect(service).toBeDefined();
  });
});
